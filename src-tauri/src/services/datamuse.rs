use std::time::Duration;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DatamuseError {
    #[error("Datamuse service is unavailable or timed out")]
    Unavailable,
    #[error("Datamuse returned an empty result")]
    EmptyResult,
    #[error("Failed to parse Datamuse response")]
    ParseError,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DatamuseWordEntry {
    pub word: String,
    #[serde(default)]
    pub score: u32,
}

/// URL encode a string parameter without adding external dependencies
pub fn url_encode(s: &str) -> String {
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

/// Filter candidate words according to MCQ distractor quality rules:
/// 1. Exclude any candidate that contains the target word as a substring (or vice versa) — case-insensitive.
/// 2. Exclude candidates whose char length differs from the target word by more than 4.
/// 3. Exclude multi-word results (phrases with spaces), unless the target word is itself a phrase.
pub fn filter_distractor_candidates(candidates: &[String], target_word: &str) -> Vec<String> {
    let clean_target = target_word.trim().to_lowercase();
    if clean_target.is_empty() {
        return Vec::new();
    }

    let target_is_phrase = clean_target.contains(' ');
    let target_char_len = clean_target.chars().count() as isize;

    candidates
        .iter()
        .map(|w| w.trim().to_string())
        .filter(|candidate| {
            let clean_candidate = candidate.to_lowercase();
            if clean_candidate.is_empty() {
                return false;
            }

            // Substring exclusion (both ways, case-insensitive)
            if clean_candidate.contains(&clean_target) || clean_target.contains(&clean_candidate) {
                return false;
            }

            // Phrase / multi-word rule
            let candidate_is_phrase = clean_candidate.contains(' ');
            if candidate_is_phrase && !target_is_phrase {
                return false;
            }

            // Length difference rule (<= 4 characters difference)
            let candidate_char_len = clean_candidate.chars().count() as isize;
            if (candidate_char_len - target_char_len).abs() > 4 {
                return false;
            }

            true
        })
        .collect()
}

/// Parse Datamuse JSON response into a list of words, sorted descending by score
pub fn parse_datamuse_response(json_str: &str) -> Result<Vec<String>, DatamuseError> {
    let mut entries: Vec<DatamuseWordEntry> = serde_json::from_str(json_str)
        .map_err(|_| DatamuseError::ParseError)?;

    if entries.is_empty() {
        return Err(DatamuseError::EmptyResult);
    }

    // Datamuse typically returns sorted by score desc, but ensure sorting
    entries.sort_by(|a, b| b.score.cmp(&a.score));

    let words: Vec<String> = entries.into_iter().map(|e| e.word).collect();
    Ok(words)
}

/// Fetch related words synchronously from Datamuse API
pub fn fetch_related_words_sync(word: &str, max: u8) -> Result<Vec<String>, DatamuseError> {
    let clean = word.trim();
    if clean.is_empty() {
        return Err(DatamuseError::EmptyResult);
    }

    let encoded_word = url_encode(clean);
    let max_count = if max == 0 { 10 } else { max };
    let url = format!("https://api.datamuse.com/words?ml={}&max={}", encoded_word, max_count);

    let resp = ureq::get(&url)
        .set("User-Agent", "Lisan-Learning-OS/1.0 (https://github.com/Omar-b381/Lisan)")
        .timeout(Duration::from_secs(5))
        .call()
        .map_err(|_| DatamuseError::Unavailable)?;

    if resp.status() != 200 {
        return Err(DatamuseError::Unavailable);
    }

    let json_text = resp.into_string().map_err(|_| DatamuseError::ParseError)?;
    parse_datamuse_response(&json_text)
}

/// Calls GET https://api.datamuse.com/words?ml={word}&max={max} asynchronously.
pub async fn fetch_related_words(word: &str, max: u8) -> Result<Vec<String>, DatamuseError> {
    let word_owned = word.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        fetch_related_words_sync(&word_owned, max)
    })
    .await
    .map_err(|_| DatamuseError::Unavailable)?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter_rejects_substrings_and_inflections() {
        let target = "happy";
        let candidates = vec![
            "happiness".to_string(), // contains target "happy"
            "unhappy".to_string(),   // contains target "happy"
            "hap".to_string(),       // target contains "hap"
            "joyful".to_string(),    // valid
            "glad".to_string(),      // valid
            "cheerful".to_string(),  // valid
        ];

        let filtered = filter_distractor_candidates(&candidates, target);
        assert!(!filtered.contains(&"happiness".to_string()));
        assert!(!filtered.contains(&"unhappy".to_string()));
        assert!(!filtered.contains(&"hap".to_string()));
        assert!(filtered.contains(&"joyful".to_string()));
        assert!(filtered.contains(&"glad".to_string()));
        assert!(filtered.contains(&"cheerful".to_string()));
    }

    #[test]
    fn test_filter_rejects_phrases_unless_target_is_phrase() {
        let single_target = "fast";
        let candidates = vec![
            "quick".to_string(),
            "at high speed".to_string(), // phrase rejected
            "rapid".to_string(),
            "swift motion".to_string(),  // phrase rejected
        ];

        let filtered = filter_distractor_candidates(&candidates, single_target);
        assert_eq!(filtered, vec!["quick".to_string(), "rapid".to_string()]);

        // When target is itself a phrase
        let phrase_target = "wake up";
        let phrase_candidates = vec![
            "get up".to_string(),
            "arise".to_string(),
            "wake earlier".to_string(), // contains "wake" -> rejected
        ];
        let phrase_filtered = filter_distractor_candidates(&phrase_candidates, phrase_target);
        assert!(phrase_filtered.contains(&"get up".to_string()));
        assert!(phrase_filtered.contains(&"arise".to_string()));
        assert!(!phrase_filtered.contains(&"wake earlier".to_string()));
    }

    #[test]
    fn test_filter_rejects_extreme_length_differences() {
        let target = "cat"; // length 3
        let candidates = vec![
            "dog".to_string(),                  // len 3 (diff 0) - accept
            "kitten".to_string(),               // len 6 (diff 3) - accept
            "feline".to_string(),               // len 6 (diff 3) - accept
            "domesticated animal".to_string(),  // phrase and len > 7 - reject
            "carnivorousmammal".to_string(),    // len 17 (diff 14) - reject
        ];

        let filtered = filter_distractor_candidates(&candidates, target);
        assert!(filtered.contains(&"dog".to_string()));
        assert!(filtered.contains(&"kitten".to_string()));
        assert!(filtered.contains(&"feline".to_string()));
        assert!(!filtered.contains(&"carnivorousmammal".to_string()));
    }

    #[test]
    fn test_parse_datamuse_response() {
        let raw_json = r#"[
            {"word": "cheerful", "score": 98212},
            {"word": "joyful", "score": 95400},
            {"word": "glad", "score": 91200}
        ]"#;

        let words = parse_datamuse_response(raw_json).expect("Should parse");
        assert_eq!(words, vec!["cheerful", "joyful", "glad"]);
    }

    #[test]
    fn test_parse_empty_response_returns_error() {
        let raw_json = "[]";
        let res = parse_datamuse_response(raw_json);
        assert_eq!(res, Err(DatamuseError::EmptyResult));
    }

    #[test]
    fn test_parse_malformed_json_returns_error() {
        let bad_json = "not json";
        let res = parse_datamuse_response(bad_json);
        assert_eq!(res, Err(DatamuseError::ParseError));
    }

    #[test]
    #[ignore] // Integration test - network gated
    fn test_live_datamuse_call() {
        let res = fetch_related_words_sync("happy", 10);
        assert!(res.is_ok());
        let words = res.unwrap();
        assert!(!words.is_empty());
    }
}
