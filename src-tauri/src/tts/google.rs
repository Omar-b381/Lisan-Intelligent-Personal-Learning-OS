use serde_json::json;
use std::time::Duration;

use crate::errors::{AppError, AppResult};
use super::models::{Language, TtsRequest, Voice};
use super::provider::{SynthesizedAudio, TtsProvider};

pub struct GoogleTtsProvider {
    api_key: Option<String>,
}

impl GoogleTtsProvider {
    pub fn new(api_key: Option<String>) -> Self {
        Self { api_key }
    }

    pub fn set_api_key(&mut self, api_key: Option<String>) {
        self.api_key = api_key;
    }
}

impl TtsProvider for GoogleTtsProvider {
    fn provider_name(&self) -> &'static str {
        "google"
    }

    fn is_available(&self) -> bool {
        self.api_key.as_ref().map(|k| !k.trim().is_empty()).unwrap_or(false)
    }

    fn supported_languages(&self) -> Vec<Language> {
        vec![
            Language {
                code: "en-US".to_string(),
                display_name: "English (US) - Neural2 / Wavenet".to_string(),
                native_name: "English (US)".to_string(),
            },
            Language {
                code: "en-GB".to_string(),
                display_name: "English (UK) - Wavenet".to_string(),
                native_name: "English (UK)".to_string(),
            },
            Language {
                code: "ar-XA".to_string(),
                display_name: "Arabic (Standard) - Wavenet".to_string(),
                native_name: "العربية الفصحى".to_string(),
            },
            Language {
                code: "fr-FR".to_string(),
                display_name: "French (France)".to_string(),
                native_name: "Français".to_string(),
            },
            Language {
                code: "de-DE".to_string(),
                display_name: "German (Germany)".to_string(),
                native_name: "Deutsch".to_string(),
            },
            Language {
                code: "es-ES".to_string(),
                display_name: "Spanish (Spain)".to_string(),
                native_name: "Español".to_string(),
            },
            Language {
                code: "ja-JP".to_string(),
                display_name: "Japanese (Japan)".to_string(),
                native_name: "日本語".to_string(),
            },
        ]
    }

    fn available_voices(&self, language: Option<&str>) -> AppResult<Vec<Voice>> {
        let lang = language.unwrap_or("en-US");
        let voices = match lang {
            s if s.starts_with("ar") => vec![
                Voice {
                    id: "ar-XA-Wavenet-A".to_string(),
                    name: "Arabic Wavenet A (Female)".to_string(),
                    language: "ar-XA".to_string(),
                    gender: Some("female".to_string()),
                    provider: "google".to_string(),
                    is_default: true,
                },
                Voice {
                    id: "ar-XA-Wavenet-B".to_string(),
                    name: "Arabic Wavenet B (Male)".to_string(),
                    language: "ar-XA".to_string(),
                    gender: Some("male".to_string()),
                    provider: "google".to_string(),
                    is_default: false,
                },
            ],
            s if s.starts_with("en-GB") => vec![
                Voice {
                    id: "en-GB-Wavenet-A".to_string(),
                    name: "British Wavenet A (Female)".to_string(),
                    language: "en-GB".to_string(),
                    gender: Some("female".to_string()),
                    provider: "google".to_string(),
                    is_default: true,
                },
                Voice {
                    id: "en-GB-Wavenet-B".to_string(),
                    name: "British Wavenet B (Male)".to_string(),
                    language: "en-GB".to_string(),
                    gender: Some("male".to_string()),
                    provider: "google".to_string(),
                    is_default: false,
                },
            ],
            _ => vec![
                Voice {
                    id: "en-US-Neural2-F".to_string(),
                    name: "US Neural2 F (Female)".to_string(),
                    language: "en-US".to_string(),
                    gender: Some("female".to_string()),
                    provider: "google".to_string(),
                    is_default: true,
                },
                Voice {
                    id: "en-US-Neural2-D".to_string(),
                    name: "US Neural2 D (Male)".to_string(),
                    language: "en-US".to_string(),
                    gender: Some("male".to_string()),
                    provider: "google".to_string(),
                    is_default: false,
                },
                Voice {
                    id: "en-US-Wavenet-C".to_string(),
                    name: "US Wavenet C (Female)".to_string(),
                    language: "en-US".to_string(),
                    gender: Some("female".to_string()),
                    provider: "google".to_string(),
                    is_default: false,
                },
            ],
        };

        Ok(voices)
    }

    fn synthesize(&self, request: &TtsRequest) -> AppResult<SynthesizedAudio> {
        let key = self.api_key.as_ref().ok_or_else(|| {
            AppError::Validation("Google Cloud Text-to-Speech API key is not configured".to_string())
        })?;

        let lang_code = request.language.clone().unwrap_or_else(|| "en-US".to_string());
        let voice_name = request.voice.clone().unwrap_or_else(|| {
            if lang_code.starts_with("ar") {
                "ar-XA-Wavenet-A".to_string()
            } else {
                "en-US-Neural2-F".to_string()
            }
        });

        let speed = request.speed.unwrap_or(1.0).clamp(0.25, 4.0);
        let pitch = request.pitch.unwrap_or(0.0).clamp(-20.0, 20.0);

        let body = json!({
            "input": {
                "text": request.text
            },
            "voice": {
                "languageCode": lang_code,
                "name": voice_name
            },
            "audioConfig": {
                "audioEncoding": "MP3",
                "speakingRate": speed,
                "pitch": pitch
            }
        });

        let url = format!("https://texttospeech.googleapis.com/v1/text:synthesize?key={}", key);
        let resp = ureq::post(&url)
            .set("Content-Type", "application/json")
            .timeout(Duration::from_secs(15))
            .send_json(&body);

        let response = match resp {
            Ok(r) => r,
            Err(ureq::Error::Status(code, r)) => {
                let err_text = r.into_string().unwrap_or_default();
                return Err(AppError::Internal(format!("Google TTS API error (HTTP {}): {}", code, err_text)));
            }
            Err(e) => {
                return Err(AppError::Internal(format!("Google Cloud TTS request network failed: {}", e)));
            }
        };

        let json_resp: serde_json::Value = response.into_json()
            .map_err(|e| AppError::Internal(format!("Failed to parse Google TTS JSON response: {}", e)))?;

        let audio_base64 = json_resp["audioContent"].as_str()
            .ok_or_else(|| AppError::Internal("Missing audioContent in Google TTS response".to_string()))?;

        let audio_data = decode_base64(audio_base64)
            .map_err(|e| AppError::Internal(format!("Failed to decode Google audio base64: {}", e)))?;

        Ok(SynthesizedAudio {
            data: audio_data,
            mime_type: "audio/mp3",
            duration_ms: 1500,
        })
    }
}

fn decode_base64(s: &str) -> Result<Vec<u8>, String> {
    let s = s.trim();
    let mut table = [255u8; 256];
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i, &c) in CHARSET.iter().enumerate() {
        table[c as usize] = i as u8;
    }

    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0;

    for &b in s.as_bytes() {
        if b == b'=' || b == b'\r' || b == b'\n' || b == b' ' {
            continue;
        }
        let val = table[b as usize];
        if val == 255 {
            return Err(format!("Invalid character: {}", b as char));
        }
        buf = (buf << 6) | (val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }

    Ok(out)
}
