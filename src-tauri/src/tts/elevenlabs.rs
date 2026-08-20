use reqwest::blocking::Client;
use serde_json::json;
use std::time::Duration;

use crate::errors::{AppError, AppResult};
use super::models::{ElevenLabsAccountInfo, Language, TtsRequest, Voice};
use super::provider::{SynthesizedAudio, TtsProvider};

pub struct ElevenLabsProvider {
    api_key: Option<String>,
    client: Client,
}

impl ElevenLabsProvider {
    pub fn new(api_key: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self { api_key, client }
    }

    pub fn set_api_key(&mut self, api_key: Option<String>) {
        self.api_key = api_key;
    }

    pub fn verify_key(key: &str) -> AppResult<ElevenLabsAccountInfo> {
        let client = Client::builder()
            .timeout(Duration::from_secs(12))
            .build()
            .unwrap_or_else(|_| Client::new());

        let clean_key = key.trim().trim_matches('"').trim_matches('\'');
        let resp = client.get("https://api.elevenlabs.io/v1/user/subscription")
            .header("xi-api-key", clean_key)
            .send()
            .map_err(|e| AppError::Internal(format!("Network connection error: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().unwrap_or_default();
            return Err(AppError::Internal(format!("ElevenLabs Verification Error (HTTP {}): {}", status, err_text)));
        }

        let json: serde_json::Value = resp.json()
            .map_err(|e| AppError::Internal(format!("Failed to parse response: {}", e)))?;

        let tier = json["tier"].as_str().unwrap_or("free").to_string();
        let character_count = json["character_count"].as_u64().unwrap_or(0);
        let character_limit = json["character_limit"].as_u64().unwrap_or(10000);
        let status = json["status"].as_str().unwrap_or("active").to_string();

        Ok(ElevenLabsAccountInfo {
            tier,
            character_count,
            character_limit,
            status,
        })
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
        let resp = self.client.post(&url)
            .header("xi-api-key", key)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .map_err(|e| AppError::Internal(format!("ElevenLabs network request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let err_text = resp.text().unwrap_or_default();
            return Err(AppError::Internal(format!("ElevenLabs API error (HTTP {}): {}", status, err_text)));
        }

        let audio_bytes = resp.bytes()
            .map_err(|e| AppError::Internal(format!("Failed to read ElevenLabs response audio bytes: {}", e)))?
            .to_vec();

        Ok(SynthesizedAudio {
            data: audio_bytes,
            mime_type: "audio/mp3",
            duration_ms: 1500,
        })
    }
}
