use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;

use crate::database::repositories::TtsRepository;
use crate::errors::{AppError, AppResult};
use crate::services::TtsService;
use crate::tts::models::TtsRequest;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordTimestamp {
    pub word: String,
    pub start_secs: f64,
    pub end_secs: f64,
    pub word_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioWithAlignmentDto {
    pub base64_data: String,
    pub mime_type: String,
    pub duration_ms: u32,
    pub word_timestamps: Vec<WordTimestamp>,
    pub has_alignment: bool,
    pub provider: String,
}

pub struct TtsAlignmentService;

impl TtsAlignmentService {
    /// Synthesize passage audio with word-level alignment where supported (ElevenLabs),
    /// falling back cleanly to standard TTS without alignment (Google/System TTS).
    pub fn synthesize_passage(
        tts_service: &Arc<TtsService>,
        db: &crate::database::connection::Database,
        text: &str,
        preferred_provider: Option<&str>,
        preferred_voice: Option<&str>,
    ) -> AppResult<AudioWithAlignmentDto> {
        let clean_text = text.trim();
        if clean_text.is_empty() {
            return Err(AppError::Validation("Passage text cannot be empty".to_string()));
        }

        let conn = db.get_connection();
        let eleven_key = TtsRepository::get_provider_credentials(&conn, "elevenlabs")?.unwrap_or_default();
        let provider = preferred_provider.unwrap_or_else(|| {
            if !eleven_key.trim().is_empty() {
                "elevenlabs"
            } else {
                "system"
            }
        });

        // 1. If ElevenLabs is selected and key is present, attempt timestamped alignment
        if provider == "elevenlabs" && !eleven_key.trim().is_empty() {
            if let Ok(aligned) = Self::synthesize_elevenlabs_with_timestamps(&eleven_key, clean_text, preferred_voice) {
                return Ok(aligned);
            }
        }

        // 2. Fallback to standard TtsService synthesis (without word alignment)
        let tts_res = tts_service.synthesize(TtsRequest {
            text: clean_text.to_string(),
            language: Some("en-US".to_string()),
            provider: Some(provider.to_string()),
            voice: preferred_voice.map(|v| v.to_string()),
            speed: Some(1.0),
            pitch: Some(1.0),
            output_format: None,
        })?;

        let base64_data = tts_res.base64_data.unwrap_or_default();

        Ok(AudioWithAlignmentDto {
            base64_data,
            mime_type: tts_res.mime_type,
            duration_ms: tts_res.duration_ms,
            word_timestamps: Vec::new(),
            has_alignment: false,
            provider: provider.to_string(),
        })
    }

    /// Call ElevenLabs /with-timestamps endpoint and aggregate characters into word timestamps
    fn synthesize_elevenlabs_with_timestamps(
        api_key: &str,
        text: &str,
        voice_id: Option<&str>,
    ) -> AppResult<AudioWithAlignmentDto> {
        let selected_voice = voice_id
            .filter(|v| !v.trim().is_empty() && *v != "default")
            .unwrap_or("pNInz6obpgDQGcFmaJgB"); // Adam default

        let body = json!({
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "use_speaker_boost": true
            }
        });

        let url = format!(
            "https://api.elevenlabs.io/v1/text-to-speech/{}/with-timestamps?output_format=mp3_44100_128",
            selected_voice
        );

        let resp = ureq::post(&url)
            .set("xi-api-key", api_key.trim())
            .set("Content-Type", "application/json")
            .timeout(Duration::from_secs(30))
            .send_json(&body)
            .map_err(|e| AppError::Internal(format!("ElevenLabs with-timestamps error: {}", e)))?;

        let json_val: serde_json::Value = resp.into_json()
            .map_err(|e| AppError::Internal(format!("Failed to parse ElevenLabs response: {}", e)))?;

        let audio_base64 = json_val["audio_base64"]
            .as_str()
            .ok_or_else(|| AppError::Internal("Missing audio_base64 in response".to_string()))?
            .to_string();

        let alignment = &json_val["alignment"];
        let chars_val = alignment["characters"].as_array();
        let starts_val = alignment["character_start_times_seconds"].as_array();
        let ends_val = alignment["character_end_times_seconds"].as_array();

        let mut word_timestamps = Vec::new();

        if let (Some(chars), Some(starts), Some(ends)) = (chars_val, starts_val, ends_val) {
            let mut current_word = String::new();
            let mut word_start = 0.0;
            let mut word_end = 0.0;
            let mut in_word = false;
            let mut word_idx = 0;

            for i in 0..chars.len() {
                let ch_str = chars[i].as_str().unwrap_or("");
                let ch_start = starts.get(i).and_then(|v| v.as_f64()).unwrap_or(0.0);
                let ch_end = ends.get(i).and_then(|v| v.as_f64()).unwrap_or(0.0);

                let is_whitespace = ch_str.chars().all(|c| c.is_whitespace());

                if !is_whitespace {
                    if !in_word {
                        in_word = true;
                        word_start = ch_start;
                        current_word = String::new();
                    }
                    current_word.push_str(ch_str);
                    word_end = ch_end;
                } else if in_word {
                    // Word boundary reached
                    in_word = false;
                    let clean = current_word.trim().to_string();
                    if !clean.is_empty() {
                        word_timestamps.push(WordTimestamp {
                            word: clean,
                            start_secs: word_start,
                            end_secs: word_end,
                            word_index: word_idx,
                        });
                        word_idx += 1;
                    }
                    current_word = String::new();
                }
            }

            // Flush last word if any
            if in_word && !current_word.trim().is_empty() {
                word_timestamps.push(WordTimestamp {
                    word: current_word.trim().to_string(),
                    start_secs: word_start,
                    end_secs: word_end,
                    word_index: word_idx,
                });
            }
        }

        let duration_ms = word_timestamps
            .last()
            .map(|w| (w.end_secs * 1000.0) as u32)
            .unwrap_or(2000);

        Ok(AudioWithAlignmentDto {
            base64_data: audio_base64,
            mime_type: "audio/mp3".to_string(),
            duration_ms,
            word_timestamps,
            has_alignment: true,
            provider: "elevenlabs".to_string(),
        })
    }
}
