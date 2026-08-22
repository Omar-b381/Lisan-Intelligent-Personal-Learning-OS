use std::sync::Arc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::domain::card::Card;
use crate::errors::{AppError, AppResult};
use super::grounding::GroundingService;
use super::models::{ChatRequest, GeneratedQuestionDraft, QuestionOptions};
use super::providers::AiProvider;

pub struct QuestionGenerator {
    grounding_service: Arc<GroundingService>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
            grounding_service: Arc::new(GroundingService::new()),
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
        card: &Card,
        provider: &dyn AiProvider,
        model_id: &str,
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

        // 2. Build Prompt focused strictly on user's deck card term & meaning
        let system_prompt = r#"أنت معلم لغوي متخصص في توليد أسئلة اختيار من متعدد لاختبار الكلمات والمفردات المحفوظة في بطاقات المستخدم (Flashcards).
يجب أن يختبر السؤال بدقة الكلمة الهدف (TARGET_TERM) ومطابقتها للمعنى المحدد في بطاقة المستخدم (TARGET_MEANING).
لا تسأل عن كلمات أو مصطلحات خارجية غير موجودة في البطاقة.

أنماط الأسئلة المعتمدة:
1. سؤال يختبر المعنى الدقيق للكلمة TARGET_TERM (تكون الإجابة الصحيحة مطابقة لمعنى TARGET_MEANING).
2. جملة تطبيقية مفيدة بها فراغ _____ ويكون الخيار الصحيح هو الكلمة TARGET_TERM.
3. سؤال يطرح المعنى TARGET_MEANING ويسأل عن الكلمة المناسبة له من بين الخيارات.

يجب أن ترجع JSON صِرف فقط، دون أي نص إضافي قبله أو بعده:
{
  "question": "نص السؤال الواضح والمباشر",
  "options": {
    "a": "الخيار الأول",
    "b": "الخيار الثاني",
    "c": "الخيار الثالث",
    "d": "الخيار الرابع"
  },
  "correct_option": "a",
  "explanation": "شرح مختصر لسبب صحة الإجابة ومعنى الكلمة",
  "used_grounded_sentence": true
}

قواعد صارمة:
1. الإجابة الصحيحة يجب أن تطابق تماماً المعنى أو الكلمة المحددة في البطاقة (TARGET_TERM / TARGET_MEANING).
2. الخيارات المموّهة الثلاثة يجب أن تكون معقولة من نفس الفئة اللغوية ولا تتطابق مع المعنى الصحيح.
3. اكتب السؤال والخيارات بنفس لغة البطاقة (عربي أو إنجليزي).
4. لا تضع أي نص خارج كائن الـ JSON."#;

        let grounded_sentence_str = grounded.as_ref().map(|g| g.sentence.as_str()).unwrap_or("NONE");

        let user_prompt = format!(
            "TARGET_TERM: {}\nTARGET_MEANING: {}\nTARGET_LANGUAGE: {}\nEXAMPLE_CONTEXT: {}",
            term,
            card.back.trim(),
            language,
            grounded_sentence_str
        );

        let chat_req = ChatRequest {
            system_prompt: system_prompt.to_string(),
            user_prompt,
            max_tokens: 500,
            json_mode: true,
        };

        // 3. Call AI Provider with fallback support
        let (raw_response, parsed_draft) = match provider.generate_chat(&chat_req) {
            Ok(resp) => {
                match Self::parse_draft(&resp.raw_text) {
                    Ok(draft) => (resp.raw_text, draft),
                    Err(_) => {
                        // Retry once
                        if let Ok(retry_resp) = provider.generate_chat(&chat_req) {
                            if let Ok(retry_draft) = Self::parse_draft(&retry_resp.raw_text) {
                                (retry_resp.raw_text, retry_draft)
                            } else {
                                let fallback = Self::generate_fallback_draft(card, &grounded, &language);
                                (resp.raw_text, fallback)
                            }
                        } else {
                            let fallback = Self::generate_fallback_draft(card, &grounded, &language);
                            (resp.raw_text, fallback)
                        }
                    }
                }
            }
            Err(_) => {
                let fallback = Self::generate_fallback_draft(card, &grounded, &language);
                (serde_json::to_string(&fallback).unwrap_or_default(), fallback)
            }
        };

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
            raw_response,
            content_hash,
        })
    }

    /// Robust JSON extractor that finds JSON objects within raw model text
    pub fn extract_json_str(raw: &str) -> &str {
        let trimmed = raw.trim();

        // 1. Try finding outermost `{` and `}`
        if let (Some(first_brace), Some(last_brace)) = (trimmed.find('{'), trimmed.rfind('}')) {
            if last_brace > first_brace {
                return &trimmed[first_brace..=last_brace];
            }
        }

        // 2. Try markdown fence unwrapping
        if let Some(start_fence) = trimmed.find("```") {
            let after_fence = &trimmed[start_fence + 3..];
            let after_lang = if let Some(idx) = after_fence.find('\n') {
                &after_fence[idx + 1..]
            } else {
                after_fence.trim_start_matches("json").trim()
            };
            if let Some(end_fence) = after_lang.rfind("```") {
                return after_lang[..end_fence].trim();
            }
        }

        trimmed
    }

    pub fn parse_draft(raw_json: &str) -> AppResult<GeneratedQuestionDraft> {
        let json_slice = Self::extract_json_str(raw_json);

        let parsed: serde_json::Value = serde_json::from_str(json_slice)
            .map_err(|e| AppError::Validation(format!("Invalid JSON format in model output: {e}")))?;

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
            "a" | "option_a" | "option a" | "1" => "a".to_string(),
            "b" | "option_b" | "option b" | "2" => "b".to_string(),
            "c" | "option_c" | "option c" | "3" => "c".to_string(),
            "d" | "option_d" | "option d" | "4" => "d".to_string(),
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

    /// Intelligent deterministic fallback question generator if AI fails or returns empty response
    pub fn generate_fallback_draft(
        card: &Card,
        grounded: &Option<super::models::GroundedExample>,
        language: &str,
    ) -> GeneratedQuestionDraft {
        let term = card.front.replace("{{c1::", "").replace("}}", "").trim().to_string();
        let meaning = card.back.trim().to_string();

        if language == "ar" {
            if let Some(g) = grounded {
                let sentence_with_blank = g.sentence.replace(&term, "_____");
                GeneratedQuestionDraft {
                    question: format!("اختر الكلمة المناسبة لملء الفراغ: \"{}\"", sentence_with_blank),
                    options: QuestionOptions {
                        a: term.clone(),
                        b: "كلمة بديلة غير مناسبة للسياق".to_string(),
                        c: "معنى مناقض تماماً".to_string(),
                        d: "استخدام لغوي غير دقيق".to_string(),
                    },
                    correct_option: "a".to_string(),
                    explanation: format!("الكلمة الصحيحة في هذا السياق هي \"{}\" وتعني: {}", term, meaning),
                    used_grounded_sentence: Some(true),
                }
            } else {
                GeneratedQuestionDraft {
                    question: format!("ما هو المعنى الدقيق لكلمة أو مصطلح: \"{}\"؟", term),
                    options: QuestionOptions {
                        a: meaning.clone(),
                        b: "معنى مغاير لسياق المصطلح".to_string(),
                        c: "تفسير نحوي غير مطابق".to_string(),
                        d: "معنى ثانوي غير مقصود هنا".to_string(),
                    },
                    correct_option: "a".to_string(),
                    explanation: format!("المعنى الصحيح للمصطلح هو: {}", meaning),
                    used_grounded_sentence: Some(false),
                }
            }
        } else {
            if let Some(g) = grounded {
                let sentence_with_blank = g.sentence.replace(&term, "_____");
                GeneratedQuestionDraft {
                    question: format!("Choose the correct word to complete the sentence: \"{}\"", sentence_with_blank),
                    options: QuestionOptions {
                        a: term.clone(),
                        b: "An incorrect alternative context".to_string(),
                        c: "An antonym or opposite meaning".to_string(),
                        d: "A grammatically mismatching term".to_string(),
                    },
                    correct_option: "a".to_string(),
                    explanation: format!("The correct word is \"{}\", which means: {}", term, meaning),
                    used_grounded_sentence: Some(true),
                }
            } else {
                GeneratedQuestionDraft {
                    question: format!("What is the most accurate definition of \"{}\"?", term),
                    options: QuestionOptions {
                        a: meaning.clone(),
                        b: "An opposite or unrelated meaning".to_string(),
                        c: "A secondary definition not fitting the main usage".to_string(),
                        d: "A misleading alternative definition".to_string(),
                    },
                    correct_option: "a".to_string(),
                    explanation: format!("The correct definition is: {}", meaning),
                    used_grounded_sentence: Some(false),
                }
            }
        }
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
    fn test_parse_markdown_and_conversational_json() {
        let raw_output = "Here is your practice question:\n```json\n{\n\"question\": \"اختر الكلمة المناسبة: _____ الطالب الامتحان بنجاح\",\n\"options\": {\"a\": \"اجتاز\", \"b\": \"هرب\", \"c\": \"نسي\", \"d\": \"أغلق\"},\n\"correct_option\": \"a\",\n\"explanation\": \"اجتاز الامتحان تعني نجح فيه.\"\n}\n```\nHope that helps!";
        let res = QuestionGenerator::parse_draft(raw_output);
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
