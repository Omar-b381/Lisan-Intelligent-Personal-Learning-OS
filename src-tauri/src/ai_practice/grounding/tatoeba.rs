use std::time::Duration;
use rusqlite::params;
use crate::ai_practice::models::GroundedExample;
use crate::database::connection::Database;

pub struct TatoebaGrounding {
    db: Option<Database>,
}

impl TatoebaGrounding {
    pub fn new() -> Self {
        Self { db: None }
    }

    pub fn with_db(db: Database) -> Self {
        Self { db: Some(db) }
    }

    pub fn map_lang_to_tatoeba(lang: &str) -> &'static str {
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
        let cache_key = format!("{}:{}", clean_term.to_lowercase(), tatoeba_lang);

        // 1. Check local SQLite cache first (fresh if fetched within 30 days)
        if let Some(db) = &self.db {
            let conn = db.get_connection();
            let cached: Option<GroundedExample> = conn
                .query_row(
                    "SELECT sentence, source_name, source_url, license_note 
                     FROM tatoeba_sentence_cache 
                     WHERE cache_key = ?1 
                       AND fetched_at >= datetime('now', '-30 days')",
                    params![cache_key],
                    |r| {
                        Ok(GroundedExample {
                            sentence: r.get(0)?,
                            source_name: r.get(1)?,
                            source_url: r.get(2)?,
                            license_note: r.get(3)?,
                        })
                    },
                )
                .ok();

            if let Some(example) = cached {
                return Some(example);
            }
        }

        // 2. Query Tatoeba API (attempt modern api.tatoeba.org with graceful fallback to legacy search)
        let encoded_term = urlencoding::encode(clean_term);

        // Primary modern endpoint: api.tatoeba.org
        let primary_url = format!(
            "https://api.tatoeba.org/unstable/sentences?lang={}&q={}&orphans=no&unapproved=no&limit=10",
            tatoeba_lang, encoded_term
        );

        // Legacy fallback endpoint
        let legacy_url = format!(
            "https://tatoeba.org/en/api_v0/search?query={}&from={}&orphans=no&unapproved=no",
            encoded_term, tatoeba_lang
        );

        let example = self.fetch_and_parse(&primary_url, clean_term, tatoeba_lang)
            .or_else(|| self.fetch_and_parse(&legacy_url, clean_term, tatoeba_lang));

        // 3. Cache result in SQLite if found
        if let (Some(db), Some(ex)) = (&self.db, &example) {
            let conn = db.get_connection();
            let _ = conn.execute(
                "INSERT INTO tatoeba_sentence_cache (cache_key, sentence, source_name, source_url, license_note, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
                 ON CONFLICT(cache_key) DO UPDATE SET
                     sentence = excluded.sentence,
                     source_name = excluded.source_name,
                     source_url = excluded.source_url,
                     license_note = excluded.license_note,
                     fetched_at = CURRENT_TIMESTAMP",
                params![cache_key, ex.sentence, ex.source_name, ex.source_url, ex.license_note],
            );
        }

        example
    }

    fn fetch_and_parse(&self, url: &str, clean_term: &str, expected_lang: &str) -> Option<GroundedExample> {
        let resp = ureq::get(url)
            .set("User-Agent", "Lisan-Learning-OS/1.0 (https://github.com/Omar-b381/Lisan)")
            .timeout(Duration::from_secs(6))
            .call()
            .ok()?;

        if resp.status() != 200 {
            return None;
        }

        let json_val: serde_json::Value = resp.into_json().ok()?;
        
        // Extract array from either "data" (modern API) or "results" (legacy API)
        let items = json_val.get("data")
            .and_then(|d| d.as_array())
            .or_else(|| json_val.get("results").and_then(|r| r.as_array()))?;

        let clean_term_lower = clean_term.to_lowercase();

        // Find candidate sentence containing the target term with language verification
        for item in items {
            // Response language verification: check item language if available
            if let Some(item_lang) = item.get("lang").and_then(|l| l.as_str()) {
                if !item_lang.eq_ignore_ascii_case(expected_lang) {
                    continue;
                }
            }

            if let (Some(text), Some(id)) = (item.get("text").and_then(|t| t.as_str()), item.get("id")) {
                let clean_sentence = text.trim();
                // Validate length (12-300 chars) and ensure target word is present
                if clean_sentence.len() >= 12 
                    && clean_sentence.len() <= 300 
                    && clean_sentence.to_lowercase().contains(&clean_term_lower)
                {
                    let sentence_id_str = id.to_string().replace('"', "");
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
    use crate::database::migrations::run_migrations;

    #[test]
    fn test_lang_mapping() {
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("en"), "eng");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("en-US"), "eng");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("ar"), "ara");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("ar-SA"), "ara");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("fr"), "fra");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("de"), "deu");
        assert_eq!(TatoebaGrounding::map_lang_to_tatoeba("es"), "spa");
    }

    #[test]
    fn test_urlencode() {
        assert_eq!(urlencoding::encode("apple pie"), "apple+pie");
    }

    #[test]
    fn test_tatoeba_cache_roundtrip() {
        let db = Database::in_memory().expect("In memory db failed");
        run_migrations(&db).expect("Migrations failed");

        let grounding = TatoebaGrounding::with_db(db.clone());
        
        // Seed cache
        {
            let conn = db.get_connection();
            conn.execute(
                "INSERT INTO tatoeba_sentence_cache (cache_key, sentence, source_name, source_url, license_note, fetched_at)
                 VALUES ('peace:eng', 'Peace is a virtue.', 'Tatoeba #1234', 'https://tatoeba.org/1234', 'CC BY', CURRENT_TIMESTAMP)",
                [],
            ).unwrap();
        }

        let ex = grounding.find_example("peace", "en");
        assert!(ex.is_some());
        let example = ex.unwrap();
        assert_eq!(example.sentence, "Peace is a virtue.");
        assert_eq!(example.source_name, "Tatoeba #1234");
    }
}
