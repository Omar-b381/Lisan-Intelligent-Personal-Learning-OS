use std::time::Duration;
use crate::ai_practice::models::GroundedExample;

pub struct FreeDictionaryGrounding;

impl FreeDictionaryGrounding {
    pub fn new() -> Self {
        Self
    }

    pub fn find_example(&self, word: &str, lang: &str) -> Option<GroundedExample> {
        let clean_lang = lang.trim().to_lowercase();
        // Free Dictionary API is primarily for English entries
        if !clean_lang.starts_with("en") && !clean_lang.is_empty() {
            return None;
        }

        let clean_word = word.trim();
        // Only single words or short compound nouns are supported
        if clean_word.is_empty() || clean_word.contains(' ') || clean_word.len() > 40 {
            return None;
        }

        let url = format!(
            "https://api.dictionaryapi.dev/api/v2/entries/en/{}",
            clean_word
        );

        let resp = ureq::get(&url)
            .set("User-Agent", "Lisan-Learning-OS/1.0 (https://github.com/Omar-b381/Lisan)")
            .timeout(Duration::from_secs(4))
            .call()
            .ok()?;

        let json_val: serde_json::Value = resp.into_json().ok()?;
        let entries = json_val.as_array()?;

        for entry in entries {
            if let Some(meanings) = entry.get("meanings").and_then(|m| m.as_array()) {
                for meaning in meanings {
                    if let Some(definitions) = meaning.get("definitions").and_then(|d| d.as_array()) {
                        for def in definitions {
                            if let Some(example) = def.get("example").and_then(|e| e.as_str()) {
                                let clean_example = example.trim();
                                if clean_example.len() >= 15 && clean_example.len() <= 300 {
                                    return Some(GroundedExample {
                                        sentence: clean_example.to_string(),
                                        source_name: "Free Dictionary API (Wiktionary / WordNet)".to_string(),
                                        source_url: Some(format!("https://en.wiktionary.org/wiki/{}", clean_word)),
                                        license_note: Some("CC BY-SA 3.0".to_string()),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        None
    }
}
