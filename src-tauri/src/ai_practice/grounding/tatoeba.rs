use std::time::Duration;
use crate::ai_practice::models::GroundedExample;

pub struct TatoebaGrounding;

impl TatoebaGrounding {
    pub fn new() -> Self {
        Self
    }

    fn map_lang_to_tatoeba(lang: &str) -> &'static str {
        let clean = lang.trim().to_lowercase();
        if clean.starts_with("ar") {
            "ara"
        } else if clean.starts_with("fr") {
            "fra"
        } else if clean.starts_with("de") {
            "deu"
        } else if clean.starts_with("es") {
            "spa"
        } else if clean.starts_with("it") {
            "ita"
        } else if clean.starts_with("ru") {
            "rus"
        } else if clean.starts_with("tr") {
            "tur"
        } else if clean.starts_with("ja") {
            "jpn"
        } else if clean.starts_with("zh") {
            "cmn"
        } else {
            "eng"
        }
    }

    pub fn find_example(&self, term: &str, lang: &str) -> Option<GroundedExample> {
        let clean_term = term.trim();
        if clean_term.is_empty() || clean_term.len() > 80 {
            return None;
        }

        let tatoeba_lang = Self::map_lang_to_tatoeba(lang);
        let encoded_term = urlencoding::encode(clean_term);
        let url = format!(
            "https://tatoeba.org/en/api_v0/search?query={}&from={}&orphans=no&unapproved=no",
            encoded_term, tatoeba_lang
        );

        let resp = ureq::get(&url)
            .set("User-Agent", "Lisan-Learning-OS/1.0 (https://github.com/Omar-b381/Lisan)")
            .timeout(Duration::from_secs(4))
            .call()
            .ok()?;

        let json_val: serde_json::Value = resp.into_json().ok()?;
        let results = json_val.get("results")?.as_array()?;

        // Look for best matching sentence containing the term
        for item in results {
            if let (Some(text), Some(id)) = (item.get("text").and_then(|t| t.as_str()), item.get("id")) {
                let clean_sentence = text.trim();
                // Ensure the sentence is non-empty and reasonably sized (15-250 chars)
                if clean_sentence.len() >= 12 && clean_sentence.len() <= 300 {
                    let sentence_id_str = id.to_string();
                    return Some(GroundedExample {
                        sentence: clean_sentence.to_string(),
                        source_name: format!("Tatoeba — Sentence #{} (CC BY 2.0 FR)", sentence_id_str),
                        source_url: Some(format!("https://tatoeba.org/sentences/show/{}", sentence_id_str)),
                        license_note: Some("CC BY 2.0 FR".to_string()),
                    });
                }
            }
        }

        None
    }
}

// Simple urlencoding helper to avoid adding another crate
mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut encoded = String::new();
        for b in s.as_bytes() {
            match *b {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(*b as char);
                }
                b' ' => encoded.push('+'),
                _ => {
                    encoded.push_str(&format!("%{:02X}", b));
                }
            }
        }
        encoded
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lang_mapping() {
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("en"), "eng");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("en-US"), "eng");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("ar"), "ara");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("ar-SA"), "ara");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("fr"), "fra");
    }

    #[test]
    fn test_urlencode() {
        assert_eq!(urlencoding::encode("apple pie"), "apple+pie");
    }
}
