use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::ai_practice::crypto::decrypt_api_key;
use crate::ai_practice::grounding::GroundingService;
use crate::ai_practice::providers::create_provider;
use crate::database::connection::Database;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WordLookupSource {
    Dictionary,
    Ai,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordLookupResult {
    pub word: String,
    pub definition_en: Option<String>,
    pub translation_ar: Option<String>,
    pub example_sentence: Option<String>,
    pub source: WordLookupSource,
}

pub struct WordLookupService {
    grounding: GroundingService,
}

impl WordLookupService {
    pub fn new() -> Self {
        Self {
            grounding: GroundingService::new(),
        }
    }

    /// Clean outer punctuation while preserving internal apostrophes (e.g. "\"don't,\"" -> "don't")
    pub fn clean_term(word: &str) -> String {
        let trimmed = word.trim();
        let stripped = trimmed.trim_matches(|c: char| {
            c == '"' || c == '\'' || c == '.' || c == ',' || c == ';' || c == ':'
                || c == '!' || c == '?' || c == '(' || c == ')' || c == '[' || c == ']'
                || c == '{' || c == '}' || c == '“' || c == '”' || c == '‘' || c == '’'
                || c == '—' || c == '–' || c == '-' || c == '/' || c == '\\' || c == '`'
        });
        stripped.to_string()
    }

    /// Primary lookup flow: GroundingService -> Active AI Provider -> Fallback
    pub fn lookup(&self, word: &str, context_sentence: &str, db: &Database) -> WordLookupResult {
        let clean_word = Self::clean_term(word);
        if clean_word.is_empty() {
            return WordLookupResult {
                word: word.to_string(),
                definition_en: None,
                translation_ar: None,
                example_sentence: None,
                source: WordLookupSource::None,
            };
        }

        // 1. First, check Dictionary / Grounding sources (Tatoeba / Free Dictionary)
        let grounded_ex = self.grounding.find_grounded_example(&clean_word, "en");
        let dict_def = fetch_free_dictionary_definition(&clean_word);

        // 2. Check for active AI Provider to get context-specific Arabic translation
        let ai_result = self.query_active_ai_provider(db, &clean_word, context_sentence);

        let mut translation_ar = None;
        let mut definition_en = dict_def;
        let mut source = WordLookupSource::None;

        if let Some((ar_trans, en_def)) = ai_result {
            translation_ar = Some(ar_trans);
            if definition_en.is_none() && !en_def.is_empty() {
                definition_en = Some(en_def);
            }
            source = WordLookupSource::Ai;
        } else if definition_en.is_some() || grounded_ex.is_some() {
            source = WordLookupSource::Dictionary;
        }

        let example_sentence = grounded_ex.map(|g| g.sentence);

        WordLookupResult {
            word: clean_word,
            definition_en,
            translation_ar,
            example_sentence,
            source,
        }
    }

    /// Query the currently active AI provider (if configured) for a concise translation & definition
    fn query_active_ai_provider(
        &self,
        db: &Database,
        word: &str,
        context_sentence: &str,
    ) -> Option<(String, String)> {
        // Read provider configuration and release lock immediately
        let provider_config = {
            let conn = db.get_connection();
            let row: Result<(String, String, Option<String>, String, Option<String>), _> = conn.query_row(
                "SELECT provider_key, provider_type, base_url, api_key_encrypted, model_id 
                 FROM ai_providers 
                 WHERE is_active = 1 AND is_enabled = 1 
                 LIMIT 1",
                [],
                |r| Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    r.get(4)?,
                )),
            );
            row.ok()
        };

        let (provider_key, provider_type, base_url, encrypted_key, model_id) = provider_config?;
        let raw_key = decrypt_api_key(&encrypted_key);
        if raw_key.is_empty() {
            return None;
        }

        let provider = create_provider(
            &provider_key,
            &provider_type,
            base_url.as_deref(),
            &raw_key,
            model_id.as_deref(),
        ).ok()?;

        let prompt = format!(
            "Translate the word \"{}\" in the context of this sentence:\n\"{}\"\n\nReturn ONLY in this exact format (single line, no markdown):\nArabic_Translation | English_Definition",
            word, context_sentence
        );

        let chat_req = crate::ai_practice::models::ChatRequest {
            system_prompt: "You are a concise language learning assistant. Return only Arabic translation and English definition in format: Arabic | English".to_string(),
            user_prompt: prompt,
            max_tokens: 150,
            json_mode: false,
        };

        let chat_resp = provider.generate_chat(&chat_req).ok()?;
        let clean_resp = chat_resp.raw_text.trim().replace('\n', " ");

        if let Some((ar, en)) = clean_resp.split_once('|') {
            let clean_ar = ar.trim().to_string();
            let clean_en = en.trim().to_string();
            if !clean_ar.is_empty() {
                return Some((clean_ar, clean_en));
            }
        }

        if !clean_resp.is_empty() {
            return Some((clean_resp, String::new()));
        }

        None
    }
}

/// Helper to fetch definition from Free Dictionary API
fn fetch_free_dictionary_definition(word: &str) -> Option<String> {
    let clean = word.trim();
    if clean.is_empty() || clean.contains(' ') || clean.len() > 40 {
        return None;
    }

    let url = format!("https://api.dictionaryapi.dev/api/v2/entries/en/{}", clean);
    let resp = ureq::get(&url)
        .set("User-Agent", "Lisan-Learning-OS/1.0")
        .timeout(Duration::from_millis(1500))
        .call()
        .ok()?;

    let json_val: serde_json::Value = resp.into_json().ok()?;
    let entries = json_val.as_array()?;

    for entry in entries {
        if let Some(meanings) = entry.get("meanings").and_then(|m| m.as_array()) {
            for meaning in meanings {
                let part_of_speech = meaning.get("partOfSpeech").and_then(|p| p.as_str()).unwrap_or("");
                if let Some(definitions) = meaning.get("definitions").and_then(|d| d.as_array()) {
                    for def in definitions {
                        if let Some(def_text) = def.get("definition").and_then(|d| d.as_str()) {
                            let clean_def = def_text.trim();
                            if !clean_def.is_empty() {
                                if !part_of_speech.is_empty() {
                                    return Some(format!("({}) {}", part_of_speech, clean_def));
                                } else {
                                    return Some(clean_def.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_term_strips_punctuation() {
        assert_eq!(WordLookupService::clean_term("\"hello,\""), "hello");
        assert_eq!(WordLookupService::clean_term("“world”"), "world");
        assert_eq!(WordLookupService::clean_term("don't!"), "don't");
        assert_eq!(WordLookupService::clean_term("(book)..."), "book");
    }
}
