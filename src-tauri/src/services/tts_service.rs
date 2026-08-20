use std::sync::Arc;
use std::thread;
use std::time::Duration;
use chrono::Utc;
use uuid::Uuid;

use crate::database::connection::Database;
use crate::database::repositories::{CardRepository, TtsRepository};
use crate::errors::{AppError, AppResult};
use crate::services::media_service::MediaService;
use crate::tts::cache::TtsCacheKey;
use crate::tts::elevenlabs::ElevenLabsProvider;
use crate::tts::google::GoogleTtsProvider;
use crate::tts::models::*;
use crate::tts::provider::TtsProvider;
use crate::tts::queue::BulkQueueManager;
use crate::tts::system::SystemTtsProvider;

pub struct TtsService {
    db: Database,
    media_service: Arc<MediaService>,
    system_provider: SystemTtsProvider,
    queue_manager: BulkQueueManager,
}

impl TtsService {
    pub fn new(db: Database, media_service: Arc<MediaService>) -> Self {
        Self {
            db,
            media_service,
            system_provider: SystemTtsProvider::new(),
            queue_manager: BulkQueueManager::new(),
        }
    }

    pub fn get_providers(&self) -> AppResult<Vec<ProviderInfo>> {
        let conn = self.db.get_connection();
        let google_key = TtsRepository::get_provider_credentials(&conn, "google")?.unwrap_or_default();
        let eleven_key = TtsRepository::get_provider_credentials(&conn, "elevenlabs")?.unwrap_or_default();

        Ok(vec![
            ProviderInfo {
                id: "system".to_string(),
                name: "System Speech Synthesizer".to_string(),
                description: "Built-in native offline OS speech engine. Fast, zero configuration, zero internet required.".to_string(),
                is_configured: true,
                requires_key: false,
            },
            ProviderInfo {
                id: "google".to_string(),
                name: "Google Cloud Text-to-Speech".to_string(),
                description: "High quality neural voices (Wavenet & Neural2) across 220+ languages.".to_string(),
                is_configured: !google_key.trim().is_empty(),
                requires_key: true,
            },
            ProviderInfo {
                id: "elevenlabs".to_string(),
                name: "ElevenLabs Prime Voice AI".to_string(),
                description: "Ultra-realistic human pronunciation and voice emotion in 29+ languages.".to_string(),
                is_configured: !eleven_key.trim().is_empty(),
                requires_key: true,
            },
        ])
    }

    pub fn get_available_voices(&self, provider: Option<&str>, language: Option<&str>) -> AppResult<Vec<Voice>> {
        let prov = provider.unwrap_or("system");
        match prov {
            "google" => {
                let conn = self.db.get_connection();
                let key = TtsRepository::get_provider_credentials(&conn, "google")?;
                let google = GoogleTtsProvider::new(key);
                google.available_voices(language)
            }
            "elevenlabs" => {
                let conn = self.db.get_connection();
                let key = TtsRepository::get_provider_credentials(&conn, "elevenlabs")?;
                let eleven = ElevenLabsProvider::new(key);
                eleven.available_voices(language)
            }
            _ => self.system_provider.available_voices(language),
        }
    }

    pub fn synthesize(&self, request: TtsRequest) -> AppResult<TtsResult> {
        let clean_text = request.text.trim();
        if clean_text.is_empty() {
            return Err(AppError::Validation("Cannot synthesize empty text".to_string()));
        }

        let provider_name = request.provider.as_deref().unwrap_or("system");
        let lang = request.language.clone().unwrap_or_else(|| "en-US".to_string());
        let speed = request.speed.unwrap_or(1.0);
        let pitch = request.pitch.unwrap_or(1.0);
        let text_hash = TtsCacheKey::compute_hash(&request);

        let conn = self.db.get_connection();

        // 1. Cache Check
        if let Some(existing) = TtsRepository::get_by_hash(&conn, &text_hash)? {
            // Check if file actually exists on disk
            if let Ok(base64_data) = self.media_service.get_media_base64(&existing.file_path) {
                let _ = TtsRepository::increment_play_count(&conn, &text_hash);
                return Ok(TtsResult {
                    id: existing.id,
                    text_hash,
                    text: existing.text,
                    language: existing.language,
                    provider: existing.provider,
                    voice: existing.voice,
                    speed: existing.speed,
                    pitch: existing.pitch,
                    file_path: existing.file_path,
                    base64_data: Some(base64_data),
                    mime_type: existing.mime_type,
                    file_size: existing.file_size,
                    duration_ms: existing.duration_ms,
                    cached: true,
                });
            }
        }

        // 2. Synthesize with chosen provider
        let synthesized = match provider_name {
            "google" => {
                let key = TtsRepository::get_provider_credentials(&conn, "google")?
                    .ok_or_else(|| AppError::Validation("Google TTS API key is not configured".to_string()))?;
                let google = GoogleTtsProvider::new(Some(key));
                google.synthesize(&request)?
            }
            "elevenlabs" => {
                let key = TtsRepository::get_provider_credentials(&conn, "elevenlabs")?
                    .ok_or_else(|| AppError::Validation("ElevenLabs API key is not configured".to_string()))?;
                let eleven = ElevenLabsProvider::new(Some(key));
                eleven.synthesize(&request)?
            }
            _ => self.system_provider.synthesize(&request)?,
        };

        // 3. Store into Media Vault
        let ext = if synthesized.mime_type.contains("wav") {
            "wav"
        } else if synthesized.mime_type.contains("aiff") {
            "aiff"
        } else {
            "mp3"
        };
        let original_name = format!("tts_{}_{}.{}", provider_name, text_hash, ext);
        let media_item = self.media_service.add_media(&original_name, &synthesized.data, synthesized.mime_type)?;

        // 4. Save metadata in DB
        let record = TtsAudioRecord {
            id: Uuid::new_v4().to_string(),
            text_hash: text_hash.clone(),
            text: clean_text.to_string(),
            language: lang.clone(),
            provider: provider_name.to_string(),
            voice: request.voice.clone().unwrap_or_else(|| "default".to_string()),
            speed,
            pitch,
            file_path: media_item.filename.clone(),
            mime_type: synthesized.mime_type.to_string(),
            file_size: media_item.file_size,
            duration_ms: synthesized.duration_ms,
            play_count: 1,
            last_used_at: Utc::now().to_rfc3339(),
            created_at: Utc::now().to_rfc3339(),
        };

        TtsRepository::insert(&conn, &record)?;

        let base64_data = self.media_service.get_media_base64(&media_item.filename).ok();

        Ok(TtsResult {
            id: record.id,
            text_hash,
            text: clean_text.to_string(),
            language: lang,
            provider: provider_name.to_string(),
            voice: record.voice,
            speed,
            pitch,
            file_path: media_item.filename,
            base64_data,
            mime_type: synthesized.mime_type.to_string(),
            file_size: media_item.file_size,
            duration_ms: synthesized.duration_ms,
            cached: false,
        })
    }

    pub fn test_provider(&self, provider: &str, api_key: Option<&str>) -> AppResult<TtsResult> {
        let text = match provider {
            "system" => "Testing local system speech synthesis in Lisan.",
            "google" => "Testing Google Cloud neural text to speech.",
            "elevenlabs" => "Testing ElevenLabs generative voice in Lisan.",
            _ => "Testing pronunciation.",
        };

        if let Some(key) = api_key {
            if !key.trim().is_empty() {
                let conn = self.db.get_connection();
                TtsRepository::save_provider_credentials(&conn, provider, key)?;
            }
        }

        self.synthesize(TtsRequest {
            text: text.to_string(),
            language: Some("en-US".to_string()),
            provider: Some(provider.to_string()),
            voice: None,
            speed: Some(1.0),
            pitch: Some(1.0),
            output_format: None,
        })
    }

    pub fn get_cache_stats(&self) -> AppResult<TtsCacheStats> {
        let conn = self.db.get_connection();
        TtsRepository::get_stats(&conn)
    }

    pub fn clear_cache(&self, unused_only: bool) -> AppResult<usize> {
        let conn = self.db.get_connection();
        let deleted_paths = if unused_only {
            TtsRepository::delete_unused(&conn)?
        } else {
            TtsRepository::delete_all(&conn)?
        };

        let mut deleted_count = 0;
        for path in deleted_paths {
            if let Ok(full_path) = self.media_service.get_media_path(&path) {
                if std::fs::remove_file(full_path).is_ok() {
                    deleted_count += 1;
                }
            }
        }

        Ok(deleted_count)
    }

    pub fn save_provider_credentials(&self, provider: &str, api_key: &str) -> AppResult<()> {
        let conn = self.db.get_connection();
        TtsRepository::save_provider_credentials(&conn, provider, api_key)
    }

    pub fn start_bulk_generation(
        self: &Arc<Self>,
        request: BulkGenerationRequest,
    ) -> AppResult<String> {
        let conn = self.db.get_connection();
        let cards = CardRepository::get_by_deck(&conn, &request.deck_id)?;
        if cards.is_empty() {
            return Err(AppError::NotFound("No cards found in the selected deck".to_string()));
        }

        let task_id = Uuid::new_v4().to_string();
        let total_cards = cards.len();
        let cancel_flag = self.queue_manager.register_task(&task_id, &request.deck_id, total_cards);

        let service_clone = self.clone();
        let req_clone = request.clone();
        let task_id_clone = task_id.clone();

        thread::spawn(move || {
            let mut processed = 0;
            for card in cards {
                if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                    service_clone.queue_manager.set_status(&task_id_clone, "cancelled", None);
                    return;
                }

                // Clean word/text to pronounce
                let word_to_speak = card.front.replace("{{c1::", "").replace("}}", "");
                let clean_word = word_to_speak.trim();

                if !clean_word.is_empty() {
                    let tts_req = TtsRequest {
                        text: clean_word.to_string(),
                        language: card.tags.iter().find(|t| t.contains('-')).cloned(),
                        provider: req_clone.provider.clone(),
                        voice: req_clone.voice.clone(),
                        speed: req_clone.speed,
                        pitch: Some(1.0),
                        output_format: None,
                    };

                    let _ = service_clone.synthesize(tts_req);
                }

                processed += 1;
                service_clone.queue_manager.update_progress(&task_id_clone, processed, clean_word);

                // Small delay to prevent rate limits
                thread::sleep(Duration::from_millis(150));
            }

            service_clone.queue_manager.set_status(&task_id_clone, "completed", None);
        });

        Ok(task_id)
    }

    pub fn get_bulk_progress(&self, task_id: &str) -> Option<BulkGenerationProgress> {
        self.queue_manager.get_progress(task_id)
    }

    pub fn cancel_bulk(&self, task_id: &str) {
        self.queue_manager.cancel_task(task_id);
    }
}
