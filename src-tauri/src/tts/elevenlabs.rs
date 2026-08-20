use serde_json::json;
use std::time::Duration;

use crate::errors::{AppError, AppResult};
use super::models::{ElevenLabsAccountInfo, Language, TtsRequest, Voice};
use super::provider::{SynthesizedAudio, TtsProvider};

pub struct ElevenLabsProvider {
    api_key: Option<String>,
}

impl ElevenLabsProvider {
    pub fn new(api_key: Option<String>) -> Self {
        Self { api_key }
    }

    pub fn set_api_key(&mut self, api_key: Option<String>) {
        self.api_key = api_key;
    }

    pub fn verify_key(key: &str) -> AppResult<ElevenLabsAccountInfo> {
        let clean_key = key.trim().trim_matches('"').trim_matches('\'');

        // 1. Try subscription endpoint for full character quota details
        let sub_res = ureq::get("https://api.elevenlabs.io/v1/user/subscription")
            .set("xi-api-key", clean_key)
            .timeout(Duration::from_secs(10))
            .call();

        if let Ok(resp) = sub_res {
            if resp.status() == 200 {
                if let Ok(json) = resp.into_json::<serde_json::Value>() {
                    let tier = json["tier"].as_str().unwrap_or("free").to_string();
                    let character_count = json["character_count"].as_u64().unwrap_or(0);
                    let character_limit = json["character_limit"].as_u64().unwrap_or(10000);
                    let status = json["status"].as_str().unwrap_or("active").to_string();

                    return Ok(ElevenLabsAccountInfo {
                        tier,
                        character_count,
                        character_limit,
                        status,
                    });
                }
            }
        }

        // 2. Fallback check on models endpoint (works for standard API keys without user_read permission)
        let models_res = ureq::get("https://api.elevenlabs.io/v1/models")
            .set("xi-api-key", clean_key)
            .timeout(Duration::from_secs(10))
            .call();

        match models_res {
            Ok(resp) if resp.status() == 200 => Ok(ElevenLabsAccountInfo {
                tier: "Standard".to_string(),
                character_count: 0,
                character_limit: 10000,
                status: "active (TTS Ready)".to_string(),
            }),
            Ok(resp) => {
                let err_text = resp.into_string().unwrap_or_default();
                Err(AppError::Internal(format!("ElevenLabs API Error: {}", err_text)))
            }
            Err(ureq::Error::Status(status, resp)) => {
                let err_text = resp.into_string().unwrap_or_default();
                Err(AppError::Internal(format!("ElevenLabs API Error (HTTP {}): {}", status, err_text)))
            }
            Err(e) => Err(AppError::Internal(format!("Network connection error: {}", e))),
        }
    }
}

impl TtsProvider for ElevenLabsProvider {
    fn provider_name(&self) -> &'static str {
        "elevenlabs"
    }

    fn is_available(&self) -> bool {
        self.api_key.as_ref().map(|k| !k.trim().is_empty()).unwrap_or(false)
    }

    fn supported_languages(&self) -> Vec<Language> {
        vec![
            Language {
                code: "multilingual".to_string(),
                display_name: "Eleven Multilingual v2 (29+ Languages: EN, AR, FR, ES, DE...)".to_string(),
                native_name: "Multilingual v2".to_string(),
            },
            Language {
                code: "en".to_string(),
                display_name: "English (All accents)".to_string(),
                native_name: "English".to_string(),
            },
            Language {
                code: "ar".to_string(),
                display_name: "Arabic (Modern Standard & Dialects)".to_string(),
                native_name: "العربية".to_string(),
            },
        ]
    }

    fn available_voices(&self, _language: Option<&str>) -> AppResult<Vec<Voice>> {
        // High quality standard ElevenLabs voices
        Ok(vec![
            Voice {
                id: "21m00Tcm4TlvDq8ikWAM".to_string(),
                name: "Rachel (Calm, Warm Female)".to_string(),
                language: "en-US".to_string(),
                gender: Some("female".to_string()),
                provider: "elevenlabs".to_string(),
                is_default: true,
            },
            Voice {
                id: "pNInz6obpgDQGcFmaJgB".to_string(),
                name: "Adam (Deep, Natural Male)".to_string(),
                language: "en-US".to_string(),
                gender: Some("male".to_string()),
                provider: "elevenlabs".to_string(),
                is_default: false,
            },
            Voice {
                id: "AZnzlk1XvdvUeBnXmlld".to_string(),
                name: "Domi (Strong, Energetic Female)".to_string(),
                language: "en-US".to_string(),
                gender: Some("female".to_string()),
                provider: "elevenlabs".to_string(),
                is_default: false,
            },
            Voice {
                id: "ErXwobaYiN019PkySvjV".to_string(),
                name: "Antoni (Expressive Male)".to_string(),
                language: "en-US".to_string(),
                gender: Some("male".to_string()),
                provider: "elevenlabs".to_string(),
                is_default: false,
            },
            Voice {
                id: "EXAVITQu4vr4xnSDxMaL".to_string(),
                name: "Bella (Soft, Gentle Female)".to_string(),
                language: "en-US".to_string(),
                gender: Some("female".to_string()),
                provider: "elevenlabs".to_string(),
                is_default: false,
            },
        ])
    }

    fn synthesize(&self, request: &TtsRequest) -> AppResult<SynthesizedAudio> {
        let key = self.api_key.as_ref().ok_or_else(|| {
            AppError::Validation("ElevenLabs API key is not configured".to_string())
        })?;

        let voice_id = match &request.voice {
            Some(v) if !v.trim().is_empty() && v != "default" => v.trim().to_string(),
            _ => "21m00Tcm4TlvDq8ikWAM".to_string(),
        };
        let body = json!({
            "text": request.text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "use_speaker_boost": true
            }
        });

        let url = format!("https://api.elevenlabs.io/v1/text-to-speech/{}?output_format=mp3_44100_128", voice_id);
        let resp = ureq::post(&url)
            .set("xi-api-key", key.trim())
            .set("Content-Type", "application/json")
            .timeout(Duration::from_secs(20))
            .send_json(&body);

        let response = match resp {
            Ok(r) => r,
            Err(ureq::Error::Status(code, r)) => {
                let err_text = r.into_string().unwrap_or_default();
                return Err(AppError::Internal(format!("ElevenLabs API error (HTTP {}): {}", code, err_text)));
            }
            Err(e) => {
                return Err(AppError::Internal(format!("ElevenLabs network request failed: {}", e)));
            }
        };

        use std::io::Read;
        let mut audio_bytes = Vec::new();
        response.into_reader().read_to_end(&mut audio_bytes)
            .map_err(|e| AppError::Internal(format!("Failed to read ElevenLabs response audio bytes: {}", e)))?;

        Ok(SynthesizedAudio {
            data: audio_bytes,
            mime_type: "audio/mp3",
            duration_ms: 1500,
        })
    }
}
