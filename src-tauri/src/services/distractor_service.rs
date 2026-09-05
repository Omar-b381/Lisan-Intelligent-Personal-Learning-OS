use rand::seq::SliceRandom;
use rusqlite::params;

use crate::database::connection::Database;
use super::datamuse::{fetch_related_words_sync, filter_distractor_candidates};

#[derive(Clone)]
pub struct DistractorService {
    db: Database,
}

impl DistractorService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Retrieve or generate MCQ distractors for a given target word
    pub fn get_distractors(&self, word: &str, count: u8) -> Vec<String> {
        let clean_word = word.trim();
        let target_count = count.clamp(1, 10) as usize;
        if clean_word.is_empty() {
            return self.generate_fallback_distractors(clean_word, target_count, &[]);
        }

        let conn = self.db.get_connection();

        // 1. Check distractor_cache table for word (fresh if fetched within 30 days)
        let cached_json: Option<String> = conn
            .query_row(
                "SELECT distractors FROM distractor_cache 
                 WHERE LOWER(word) = LOWER(?1) 
                   AND fetched_at >= datetime('now', '-30 days')",
                params![clean_word],
                |r| r.get(0),
            )
            .ok();

        if let Some(json_str) = cached_json {
            if let Ok(mut cached_list) = serde_json::from_str::<Vec<String>>(&json_str) {
                if !cached_list.is_empty() {
                    let mut rng = rand::thread_rng();
                    cached_list.shuffle(&mut rng);
                    if cached_list.len() >= target_count {
                        cached_list.truncate(target_count);
                        return cached_list;
                    }
                    // If cached list has fewer than requested, pad with fallbacks
                    let padded = self.generate_fallback_distractors(clean_word, target_count - cached_list.len(), &cached_list);
                    cached_list.extend(padded);
                    return cached_list;
                }
            }
        }

        // 2. Otherwise call fetch_related_words(&word, 10)
        let candidates_result = fetch_related_words_sync(clean_word, 10);

        let mut final_distractors: Vec<String> = match candidates_result {
            Ok(raw_candidates) => {
                // 3. Filter candidates
                let mut filtered = filter_distractor_candidates(&raw_candidates, clean_word);
                let mut rng = rand::thread_rng();
                filtered.shuffle(&mut rng);

                if filtered.len() >= target_count {
                    // 4. Randomly select count
                    filtered.truncate(target_count);
                    filtered
                } else {
                    // 5. If filtered list has < count items: fall back to existing random distractor logic to fill gap
                    let gap = target_count - filtered.len();
                    let fallback_items = self.generate_fallback_distractors(clean_word, gap, &filtered);
                    filtered.extend(fallback_items);
                    filtered
                }
            }
            Err(err) => {
                // 7. On any Datamuse error: log error and fall back entirely
                eprintln!("[DistractorService] Datamuse fetch failed for '{}': {:?}. Using fallback distractors.", clean_word, err);
                self.generate_fallback_distractors(clean_word, target_count, &[])
            }
        };

        // Ensure we don't exceed target_count
        final_distractors.truncate(target_count);

        // 6. Write result to distractor_cache before returning (upsert)
        if let Ok(serialized) = serde_json::to_string(&final_distractors) {
            let _ = conn.execute(
                "INSERT INTO distractor_cache (word, distractors, fetched_at)
                 VALUES (?1, ?2, CURRENT_TIMESTAMP)
                 ON CONFLICT(word) DO UPDATE SET
                     distractors = excluded.distractors,
                     fetched_at = CURRENT_TIMESTAMP",
                params![clean_word.to_lowercase(), serialized],
            );
        }

        final_distractors
    }

    /// Generates fallback distractors from existing cards in the user's database or a curated pool
    pub fn generate_fallback_distractors(&self, target_word: &str, count: usize, exclude: &[String]) -> Vec<String> {
        let clean_target = target_word.trim().to_lowercase();
        let mut results = Vec::new();
        let conn = self.db.get_connection();

        // Try getting other card terms or definitions from user database
        if let Ok(mut stmt) = conn.prepare(
            "SELECT front, back FROM cards 
             WHERE LOWER(front) != LOWER(?1) AND front NOT LIKE '%{{%' 
             ORDER BY RANDOM() LIMIT 30"
        ) {
            let rows = stmt.query_map(params![clean_target], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            });

            if let Ok(mapped_rows) = rows {
                for item in mapped_rows.flatten() {
                    let front = item.0.trim().to_string();
                    let clean_front = front.to_lowercase();
                    if !clean_front.is_empty() 
                        && clean_front != clean_target 
                        && !clean_front.contains(&clean_target)
                        && !clean_target.contains(&clean_front)
                        && !exclude.iter().any(|e| e.eq_ignore_ascii_case(&front))
                        && !results.iter().any(|r: &String| r.eq_ignore_ascii_case(&front))
                    {
                        results.push(front);
                        if results.len() >= count {
                            return results;
                        }
                    }
                }
            }
        }

        // If still need more, use preset pool
        let is_arabic = clean_target.chars().any(|c| ('\u{0600}'..='\u{06FF}').contains(&c));
        let default_pool: &[&str] = if is_arabic {
            &[
                "معنى مغاير لسياق المصطلح",
                "تفسير لغوي غير مطابق",
                "معنى ثانوي غير مقصود",
                "استخدام نحوي بديل",
                "مفهوم غير مرتبط بالسياق",
                "دلالة مجازية مختلفة",
            ]
        } else {
            &[
                "alternative context",
                "unrelated concept",
                "secondary meaning",
                "distinct definition",
                "opposite term",
                "contrasting usage",
                "approximate synonym",
                "variable phrase",
            ]
        };

        let mut pool_vec: Vec<String> = default_pool.iter().map(|s| s.to_string()).collect();
        let mut rng = rand::thread_rng();
        pool_vec.shuffle(&mut rng);

        for candidate in pool_vec {
            if !candidate.eq_ignore_ascii_case(&clean_target)
                && !exclude.iter().any(|e| e.eq_ignore_ascii_case(&candidate))
                && !results.iter().any(|r: &String| r.eq_ignore_ascii_case(&candidate))
            {
                results.push(candidate);
                if results.len() >= count {
                    break;
                }
            }
        }

        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::migrations::run_migrations;

    fn setup_test_db() -> Database {
        let db = Database::in_memory().expect("In memory db failed");
        run_migrations(&db).expect("Migrations failed");
        db
    }

    #[test]
    fn test_distractor_fallback_when_db_or_network_empty() {
        let db = setup_test_db();
        let service = DistractorService::new(db);

        let distractors = service.generate_fallback_distractors("test", 3, &[]);
        assert_eq!(distractors.len(), 3);
        assert!(!distractors.contains(&"test".to_string()));
    }

    #[test]
    fn test_cache_hit_skips_network_and_returns_cached() {
        let db = setup_test_db();
        let service = DistractorService::new(db.clone());

        // Pre-populate distractor cache
        {
            let conn = db.get_connection();
            let cached_items = vec!["option1".to_string(), "option2".to_string(), "option3".to_string()];
            let serialized = serde_json::to_string(&cached_items).unwrap();
            conn.execute(
                "INSERT INTO distractor_cache (word, distractors, fetched_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
                params!["customword", serialized],
            ).unwrap();
        }

        let res = service.get_distractors("customword", 3);
        assert_eq!(res.len(), 3);
        assert!(res.contains(&"option1".to_string()));
        assert!(res.contains(&"option2".to_string()));
        assert!(res.contains(&"option3".to_string()));
    }

    #[test]
    fn test_distractor_fallback_pads_if_filtered_is_short() {
        let db = setup_test_db();
        let service = DistractorService::new(db);

        // Test with empty/special word where Datamuse returns empty/fails
        let res = service.get_distractors("", 3);
        assert_eq!(res.len(), 3);
    }
}
