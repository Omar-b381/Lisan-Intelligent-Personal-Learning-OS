use sha2::{Digest, Sha256};
use crate::tts::models::TtsRequest;

pub struct TtsCacheKey;

impl TtsCacheKey {
    /// Generates a deterministic SHA-256 hash for a given TTS synthesis request
    pub fn compute_hash(request: &TtsRequest) -> String {
        let clean_text = request.text.trim().to_lowercase();
        let language = request.language.as_deref().unwrap_or("default");
        let provider = request.provider.as_deref().unwrap_or("system");
        let voice = request.voice.as_deref().unwrap_or("default");
        let speed = (request.speed.unwrap_or(1.0) * 100.0).round() as i64;
        let pitch = (request.pitch.unwrap_or(1.0) * 100.0).round() as i64;

        let composite = format!(
            "{}:{}:{}:{}:{}:{}",
            clean_text, language, provider, voice, speed, pitch
        );

        let mut hasher = Sha256::new();
        hasher.update(composite.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic_hashing() {
        let req1 = TtsRequest {
            text: "achieve".to_string(),
            language: Some("en-US".to_string()),
            provider: Some("system".to_string()),
            voice: Some("default".to_string()),
            speed: Some(1.0),
            pitch: Some(1.0),
            output_format: None,
        };

        let req2 = TtsRequest {
            text: " achieve ".to_string(), // surrounding whitespace should normalize
            language: Some("en-US".to_string()),
            provider: Some("system".to_string()),
            voice: Some("default".to_string()),
            speed: Some(1.0),
            pitch: Some(1.0),
            output_format: None,
        };

        let hash1 = TtsCacheKey::compute_hash(&req1);
        let hash2 = TtsCacheKey::compute_hash(&req2);
        assert_eq!(hash1, hash2);

        // Different speed yields different hash
        let mut req3 = req1.clone();
        req3.speed = Some(0.75);
        assert_ne!(hash1, TtsCacheKey::compute_hash(&req3));
    }
}
