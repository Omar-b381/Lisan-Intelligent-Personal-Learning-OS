use std::process::Command;
use std::fs;
use directories::ProjectDirs;

use crate::errors::{AppError, AppResult};
use super::models::{Language, TtsRequest, Voice};
use super::provider::{SynthesizedAudio, TtsProvider};

pub struct SystemTtsProvider;

impl SystemTtsProvider {
    pub fn new() -> Self {
        Self
    }
}

impl TtsProvider for SystemTtsProvider {
    fn provider_name(&self) -> &'static str {
        "system"
    }

    fn is_available(&self) -> bool {
        true // Always available on desktop OS
    }

    fn supported_languages(&self) -> Vec<Language> {
        vec![
            Language {
                code: "en-US".to_string(),
                display_name: "English (US)".to_string(),
                native_name: "English (United States)".to_string(),
            },
            Language {
                code: "en-GB".to_string(),
                display_name: "English (UK)".to_string(),
                native_name: "English (United Kingdom)".to_string(),
            },
            Language {
                code: "ar-SA".to_string(),
                display_name: "Arabic (Saudi Arabia)".to_string(),
                native_name: "العربية (السعودية)".to_string(),
            },
            Language {
                code: "ar-EG".to_string(),
                display_name: "Arabic (Egypt)".to_string(),
                native_name: "العربية (مصر)".to_string(),
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
        ]
    }

    fn available_voices(&self, language: Option<&str>) -> AppResult<Vec<Voice>> {
        let mut voices = vec![
            Voice {
                id: "default".to_string(),
                name: "System Default Voice".to_string(),
                language: language.unwrap_or("en-US").to_string(),
                gender: Some("neutral".to_string()),
                provider: "system".to_string(),
                is_default: true,
            },
            Voice {
                id: "system_female".to_string(),
                name: "System Natural Female".to_string(),
                language: language.unwrap_or("en-US").to_string(),
                gender: Some("female".to_string()),
                provider: "system".to_string(),
                is_default: false,
            },
            Voice {
                id: "system_male".to_string(),
                name: "System Natural Male".to_string(),
                language: language.unwrap_or("en-US").to_string(),
                gender: Some("male".to_string()),
                provider: "system".to_string(),
                is_default: false,
            },
        ];

        if let Some(lang) = language {
            voices.retain(|v| v.language.starts_with(lang) || v.id == "default");
        }

        Ok(voices)
    }

    fn synthesize(&self, request: &TtsRequest) -> AppResult<SynthesizedAudio> {
        let text = request.text.trim();
        if text.is_empty() {
            return Err(AppError::Validation("Cannot synthesize empty text".to_string()));
        }

        let speed = request.speed.unwrap_or(1.0);
        
        #[cfg(target_os = "windows")]
        {
            // Synthesize on Windows using System.Speech via PowerShell
            let temp_dir = ProjectDirs::from("com", "lisan", "app")
                .map(|p| p.data_dir().join("tmp"))
                .unwrap_or_else(|| std::env::temp_dir());
            fs::create_dir_all(&temp_dir)?;

            let temp_wav = temp_dir.join(format!("tts_{}.wav", uuid::Uuid::new_v4()));
            let temp_wav_str = temp_wav.to_string_lossy().replace('\\', "/");

            // Convert speed (0.5 to 2.0) to SAPI Rate (-10 to 10)
            let rate: i32 = (((speed - 1.0) * 10.0).round() as i32).clamp(-10, 10);
            
            // Escape double quotes and special chars for powershell script
            let safe_text = text.replace('`', "``").replace('"', "`\"").replace('$', "`$");

            let script = format!(
                r#"Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Rate = {}; $synth.SetOutputToWaveFile("{}"); $synth.Speak("{}"); $synth.Dispose();"#,
                rate, temp_wav_str, safe_text
            );

            let output = Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                .output()
                .map_err(|e| AppError::Internal(format!("Failed to execute Windows TTS engine: {}", e)))?;

            if !output.status.success() {
                let err_str = String::from_utf8_lossy(&output.stderr);
                let _ = fs::remove_file(&temp_wav);
                return Err(AppError::Internal(format!("Windows TTS synthesis failed: {}", err_str)));
            }

            if !temp_wav.exists() {
                return Err(AppError::Internal("Windows TTS did not generate an output audio file".to_string()));
            }

            let data = fs::read(&temp_wav)?;
            let _ = fs::remove_file(&temp_wav);

            // Estimate duration in ms: 44.1kHz 16-bit mono wav is ~88200 bytes/sec
            let duration_ms = if data.len() > 44 {
                ((data.len() - 44) as u64 * 1000 / 88200) as u32
            } else {
                500
            };

            Ok(SynthesizedAudio {
                data,
                mime_type: "audio/wav",
                duration_ms: duration_ms.max(200),
            })
        }

        #[cfg(target_os = "macos")]
        {
            let temp_dir = std::env::temp_dir();
            let temp_aiff = temp_dir.join(format!("tts_{}.aiff", uuid::Uuid::new_v4()));
            let rate = (speed * 175.0) as u32;

            let output = Command::new("say")
                .args(["-r", &rate.to_string(), "-o", &temp_aiff.to_string_lossy(), text])
                .output()
                .map_err(|e| AppError::Internal(format!("macOS say failed: {}", e)))?;

            if !output.status.success() {
                let _ = fs::remove_file(&temp_aiff);
                return Err(AppError::Internal("macOS TTS failed".to_string()));
            }

            let data = fs::read(&temp_aiff)?;
            let _ = fs::remove_file(&temp_aiff);

            Ok(SynthesizedAudio {
                data,
                mime_type: "audio/aiff",
                duration_ms: 1000,
            })
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            let temp_dir = std::env::temp_dir();
            let temp_wav = temp_dir.join(format!("tts_{}.wav", uuid::Uuid::new_v4()));

            let output = Command::new("espeak")
                .args(["-w", &temp_wav.to_string_lossy(), text])
                .output()
                .map_err(|e| AppError::Internal(format!("Linux espeak failed: {}", e)))?;

            if !output.status.success() {
                let _ = fs::remove_file(&temp_wav);
                return Err(AppError::Internal("Linux TTS synthesis failed".to_string()));
            }

            let data = fs::read(&temp_wav)?;
            let _ = fs::remove_file(&temp_wav);

            Ok(SynthesizedAudio {
                data,
                mime_type: "audio/wav",
                duration_ms: 1000,
            })
        }
    }
}
