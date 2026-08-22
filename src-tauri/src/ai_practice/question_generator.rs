use rusqlite::Connection;
use sha2::{Digest, Sha256};

use crate::domain::card::Card;
use crate::errors::{AppError, AppResult};
use super::grounding::GroundingService;
use super::models::{ChatRequest, GeneratedQuestionDraft, QuestionOptions};
use super::providers::AiProvider;

pub struct QuestionGenerator {
    grounding_service: GroundingService,
}

pub struct GenerationResult {
    pub question_text: String,
    pub option_a: String,
    pub option_b: String,
    pub option_c: String,
    pub option_d: String,
    pub correct_option: String,
    pub explanation: String,
    pub grounded_sentence: Option<String>,
    pub source_citation: Option<String>,
    pub source_url: Option<String>,
    pub is_source_verified: bool,
    pub raw_response: String,
    pub content_hash: String,
}

impl QuestionGenerator {
    pub fn new() -> Self {
        Self {
            grounding_service: GroundingService::new(),
        }
    }

    pub fn compute_hash(card: &Card, provider_key: &str, model_id: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(card.id.as_bytes());
        hasher.update(card.front.trim().as_bytes());
        hasher.update(card.back.trim().as_bytes());
        hasher.update(provider_key.as_bytes());
        hasher.update(model_id.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub fn generate_for_card(
        &self,
        _conn: &Connection,
        card: &Card,
        provider: &dyn AiProvider,
        model_id: &str,
        _bypass_cache: bool,
    ) -> AppResult<GenerationResult> {
        let content_hash = Self::compute_hash(card, provider.provider_key(), model_id);

        // Detect language from tags or card content
        let language = card
            .tags
            .iter()
            .find(|t| t.contains('-') || *t == "ar" || *t == "en")
            .cloned()
            .unwrap_or_else(|| {
                // If front contains Arabic characters, use ar, otherwise en
                if card.front.chars().any(|c| ('\u{0600}'..='\u{06FF}').contains(&c)) {
                    "ar".to_string()
                } else {
                    "en".to_string()
                }
            });

        // 1. Grounding search
        let term = card.front.replace("{{c1::", "").replace("}}", "").trim().to_string();
        let grounded = self.grounding_service.find_grounded_example(&term, &language);

        // 2. Build Prompt
        let system_prompt = r#"أنت مولّد أسئلة اختيار من متعدد لتطبيق تعلّم لغوي. يجب أن ترجع JSON صِرف فقط، دون أي نص إضافي قبله أو بعده، مطابقاً تماماً لهذا المخطط:

{
  "question": "نص السؤال",
  "options": {
    "a": "الخيار الأول",
    "b": "الخيار الثاني",
    "c": "الخيار الثالث",
    "d": "الخيار الرابع"
  },
  "correct_option": "a",
  "explanation": "شرح مختصر لسبب صحة الإجابة (سطر أو سطرين)",
  "used_grounded_sentence": true
}

قواعد صارمة:
1. إن زُوِّدت بجملة حقيقية موسومة GROUNDED_SENTENCE أدناه، يجب أن يُبنى السؤال حولها مباشرة (مثال: احذف الكلمة الهدف واطلب اختيار الكلمة الصحيحة لملء الفراغ _____، أو اسأل عن المعنى الدقيق للكلمة في سياق هذه الجملة). لا تُغيّر الجملة ولا تخترع سياقاً بديلاً. اضبط "used_grounded_sentence": true.
2. إن لم تُزوَّد بجملة حقيقية (كانت NONE)، يجوز لك تأليف سؤال ومثال واقعي معقول بنفسك، لكن اضبط "used_grounded_sentence": false ولا تدّعِ أبداً وجود مصدر خارجي غير موجود.
3. الخيارات المموِّهة (الثلاثة الخاطئة) يجب أن تكون من نفس الفئة اللغوية، معقولة الظهور، وغير متداخلة المعنى مع الإجابة الصحيحة، بحيث لا يوجد أكثر من إجابة صحيحة واحدة محتملة.
4. اكتب السؤال والخيارات بنفس لغة البطاقة (عربي أو إنجليزي) المحددة في TARGET_LANGUAGE.
5. لا تُخرج أي نص خارج كائن الـ JSON."#;

        let grounded_sentence_str = grounded.as_ref().map(|g| g.sentence.as_str()).unwrap_or("NONE");
        let grounded_source_str = grounded.as_ref().map(|g| g.source_name.as_str()).unwrap_or("NONE");

        let user_prompt = format!(
            "TARGET_TERM: {}\nTARGET_MEANING: {}\nTARGET_LANGUAGE: {}\nGROUNDED_SENTENCE: {}\nGROUNDED_SOURCE: {}",
            term,
            card.back.trim(),
            language,
            grounded_sentence_str,
            grounded_source_str
        );

        let chat_req = ChatRequest {
            system_prompt: system_prompt.to_string(),
            user_prompt,
            max_tokens: 650,
            json_mode: true,
        };

        // 3. Call AI Provider with 1 retry
        let mut chat_resp = provider.generate_chat(&chat_req)?;
        let mut draft = Self::parse_draft(&chat_resp.raw_text);

        if draft.is_err() {
            // Retry once
            if let Ok(retry_resp) = provider.generate_chat(&chat_req) {
                chat_resp = retry_resp;
                draft = Self::parse_draft(&chat_resp.raw_text);
            }
        }

        let parsed_draft = draft?;

        // 4. Construct GenerationResult
        let is_verified = grounded.is_some();
        let (source_citation, source_url, grounded_sentence) = if let Some(g) = grounded {
            (Some(g.source_name), g.source_url, Some(g.sentence))
        } else {
            (None, None, None)
        };

        Ok(GenerationResult {
            question_text: parsed_draft.question,
            option_a: parsed_draft.options.a,
            option_b: parsed_draft.options.b,
            option_c: parsed_draft.options.c,
            option_d: parsed_draft.options.d,
            correct_option: parsed_draft.correct_option.to_lowercase(),
            explanation: parsed_draft.explanation,
            grounded_sentence,
            source_citation,
            source_url,
            is_source_verified: is_verified,
            raw_response: chat_resp.raw_text,
            content_hash,
        })
    }

    pub fn parse_draft(raw_json: &str) -> AppResult<GeneratedQuestionDraft> {
        let clean = raw_json.trim();
        // Remove markdown code block fences if present
        let unquoted = if clean.starts_with("```") {
            let without_start = clean.trim_start_matches('`');
            let without_lang = without_start.trim_start_matches("json").trim();
            without_lang.trim_end_matches('`').trim()
        } else {
            clean
        };

        let parsed: serde_json::Value = serde_json::from_str(unquoted)
            .map_err(|e| AppError::Serialization(e))?;

        let question = parsed["question"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'question' field in JSON".to_string()))?
            .trim()
            .to_string();

        let options_obj = parsed.get("options")
            .ok_or_else(|| AppError::Validation("Missing 'options' object in JSON".to_string()))?;

        let a = options_obj["a"].as_str().unwrap_or("").trim().to_string();
        let b = options_obj["b"].as_str().unwrap_or("").trim().to_string();
        let c = options_obj["c"].as_str().unwrap_or("").trim().to_string();
        let d = options_obj["d"].as_str().unwrap_or("").trim().to_string();

        if a.is_empty() || b.is_empty() || c.is_empty() || d.is_empty() {
            return Err(AppError::Validation("All options (a, b, c, d) must be non-empty".to_string()));
        }

        let raw_correct = parsed["correct_option"]
            .as_str()
            .unwrap_or("a")
            .trim()
            .to_lowercase();

        let correct_option = match raw_correct.as_str() {
            "a" | "option_a" => "a".to_string(),
            "b" | "option_b" => "b".to_string(),
            "c" | "option_c" => "c".to_string(),
            "d" | "option_d" => "d".to_string(),
            _ => "a".to_string(),
        };

        let explanation = parsed["explanation"]
            .as_str()
            .unwrap_or("الإجابة الصحيحة تعتمد على السياق اللغوي ومعنى الكلمة.")
            .trim()
            .to_string();

        let used_grounded_sentence = parsed["used_grounded_sentence"].as_bool();

        Ok(GeneratedQuestionDraft {
            question,
            options: QuestionOptions { a, b, c, d },
            correct_option,
            explanation,
            used_grounded_sentence,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_json() {
        let json_str = r#"{
            "question": "What is the meaning of 'ubiquitous' in the sentence: 'Smartphones are ubiquitous nowadays'?",
            "options": {
                "a": "Rare and expensive",
                "b": "Present or found everywhere",
                "c": "Difficult to understand",
                "d": "Old-fashioned"
            },
            "correct_option": "b",
            "explanation": "Ubiquitous means existing or being everywhere at the same time.",
            "used_grounded_sentence": true
        }"#;

        let res = QuestionGenerator::parse_draft(json_str);
        assert!(res.is_ok());
        let draft = res.unwrap();
        assert_eq!(draft.correct_option, "b");
        assert_eq!(draft.options.b, "Present or found everywhere");
        assert_eq!(draft.used_grounded_sentence, Some(true));
    }

    #[test]
    fn test_parse_markdown_wrapped_json() {
        let json_str = "```json\n{\n\"question\": \"اختر الكلمة المناسبة: _____ الطالب الامتحان بنجاح\",\n\"options\": {\"a\": \"اجتاز\", \"b\": \"هرب\", \"c\": \"نسي\", \"d\": \"أغلق\"},\n\"correct_option\": \"a\",\n\"explanation\": \"اجتاز الامتحان تعني نجح فيه.\"\n}\n```";
        let res = QuestionGenerator::parse_draft(json_str);
        assert!(res.is_ok());
        let draft = res.unwrap();
        assert_eq!(draft.correct_option, "a");
        assert_eq!(draft.options.a, "اجتاز");
    }

    #[test]
    fn test_parse_invalid_json() {
        let bad_json = "{ question: not valid json }";
        let res = QuestionGenerator::parse_draft(bad_json);
        assert!(res.is_err());
    }

    #[test]
    fn test_parse_missing_options() {
        let incomplete = r#"{"question": "test", "options": {"a": "one"}, "correct_option": "a"}"#;
        let res = QuestionGenerator::parse_draft(incomplete);
        assert!(res.is_err());
    }
}
