use lisan_lib::database::connection::Database;
use lisan_lib::database::migrations::run_migrations;
use lisan_lib::database::repositories::TtsRepository;
use lisan_lib::tts::cache::TtsCacheKey;
use lisan_lib::tts::models::{TtsAudioRecord, TtsRequest};
use lisan_lib::tts::provider::TtsProvider;
use lisan_lib::tts::system::SystemTtsProvider;
use chrono::Utc;
use uuid::Uuid;

#[test]
fn test_tts_cache_key_deterministic_properties() {
    let req1 = TtsRequest {
        text: "Pronunciation".to_string(),
        language: Some("en-US".to_string()),
        provider: Some("system".to_string()),
        voice: Some("default".to_string()),
        speed: Some(1.0),
        pitch: Some(1.0),
        output_format: None,
    };

    let req2 = TtsRequest {
        text: " pronunciation ".to_string(),
        language: Some("en-US".to_string()),
        provider: Some("system".to_string()),
        voice: Some("default".to_string()),
        speed: Some(1.0),
        pitch: Some(1.0),
        output_format: None,
    };

    let hash1 = TtsCacheKey::compute_hash(&req1);
    let hash2 = TtsCacheKey::compute_hash(&req2);
    assert_eq!(hash1, hash2, "Whitespace and casing should produce identical cache hash");

    // Speed change produces different hash
    let mut req3 = req1.clone();
    req3.speed = Some(0.75);
    assert_ne!(hash1, TtsCacheKey::compute_hash(&req3));
}

#[test]
fn test_system_provider_voices_and_languages() {
    let provider = SystemTtsProvider::new();
    assert_eq!(provider.provider_name(), "system");
    assert!(provider.is_available());

    let languages = provider.supported_languages();
    assert!(languages.iter().any(|l| l.code == "en-US"));
    assert!(languages.iter().any(|l| l.code == "ar-SA"));

    let voices = provider.available_voices(Some("en-US")).expect("Failed to get voices");
    assert!(!voices.is_empty());
}

#[test]
fn test_database_tts_audio_repository() {
    let db = Database::in_memory().expect("Failed to create in-memory db");
    run_migrations(&db).expect("Failed to run migrations");

    let conn = db.get_connection();
    let text_hash = "mock_hash_12345".to_string();

    let record = TtsAudioRecord {
        id: Uuid::new_v4().to_string(),
        text_hash: text_hash.clone(),
        text: "achieve".to_string(),
        language: "en-US".to_string(),
        provider: "system".to_string(),
        voice: "default".to_string(),
        speed: 1.0,
        pitch: 1.0,
        file_path: "mock_audio.wav".to_string(),
        mime_type: "audio/wav".to_string(),
        file_size: 10240,
        duration_ms: 650,
        play_count: 1,
        last_used_at: Utc::now().to_rfc3339(),
        created_at: Utc::now().to_rfc3339(),
    };

    TtsRepository::insert(&conn, &record).expect("Failed to insert TTS record");

    let retrieved = TtsRepository::get_by_hash(&conn, &text_hash)
        .expect("Failed to query TTS record")
        .expect("Record not found");

    assert_eq!(retrieved.text, "achieve");
    assert_eq!(retrieved.file_path, "mock_audio.wav");

    // Stats
    let stats = TtsRepository::get_stats(&conn).expect("Failed to get stats");
    assert_eq!(stats.total_files, 1);
    assert_eq!(stats.total_size_bytes, 10240);
}
