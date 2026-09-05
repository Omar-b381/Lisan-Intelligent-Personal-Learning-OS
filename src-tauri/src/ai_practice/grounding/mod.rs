pub mod tatoeba;
pub mod free_dictionary;

use super::models::GroundedExample;
use tatoeba::TatoebaGrounding;
use free_dictionary::FreeDictionaryGrounding;

use crate::database::connection::Database;

pub trait GroundingSource: Send + Sync {
    fn find_example(&self, term: &str, lang: &str) -> Option<GroundedExample>;
}

pub struct GroundingService {
    tatoeba: TatoebaGrounding,
    free_dict: FreeDictionaryGrounding,
}

impl GroundingService {
    pub fn new() -> Self {
        Self {
            tatoeba: TatoebaGrounding::new(),
            free_dict: FreeDictionaryGrounding::new(),
        }
    }

    pub fn with_db(db: Database) -> Self {
        Self {
            tatoeba: TatoebaGrounding::with_db(db),
            free_dict: FreeDictionaryGrounding::new(),
        }
    }

    /// Search authentic sentence sources with fallback chain:
    /// 1. Tatoeba (covers multiple languages including Arabic, English, French, Spanish, etc.)
    /// 2. Free Dictionary API (English dictionary citations)
    /// 3. Returns None if ungrounded
    pub fn find_grounded_example(&self, term: &str, lang: &str) -> Option<GroundedExample> {
        let clean_term = term.trim();
        if clean_term.is_empty() {
            return None;
        }

        // 1. Try Tatoeba
        if let Some(ex) = self.tatoeba.find_example(clean_term, lang) {
            return Some(ex);
        }

        // 2. Try Free Dictionary API
        if let Some(ex) = self.free_dict.find_example(clean_term, lang) {
            return Some(ex);
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_grounding_service_fallback_chain() {
        let service = GroundingService::new();
        // Empty term should return None immediately
        assert!(service.find_grounded_example("", "en").is_none());
        assert!(service.find_grounded_example("   ", "ar").is_none());
    }

    #[test]
    fn test_grounded_example_struct() {
        let ex = GroundedExample {
            sentence: "The quick brown fox jumps over the lazy dog.".to_string(),
            source_name: "Tatoeba — Sentence #1234 (CC BY)".to_string(),
            source_url: Some("https://tatoeba.org/sentences/show/1234".to_string()),
            license_note: Some("CC BY".to_string()),
        };

        assert_eq!(ex.sentence, "The quick brown fox jumps over the lazy dog.");
        assert!(ex.source_name.contains("Tatoeba"));
        assert!(ex.source_url.is_some());
    }
}
