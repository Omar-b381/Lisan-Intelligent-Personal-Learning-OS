pub mod commands;
pub mod database;
pub mod domain;
pub mod errors;
pub mod scheduler;
pub mod services;
pub mod tts;

use std::sync::Arc;
use commands::*;
use database::{connection::Database, migrations};
use services::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 1. Initialize Database
    let db = Database::init(None).expect("Failed to initialize SQLite database");

    // 2. Run Database Migrations
    migrations::run_migrations(&db).expect("Failed to run database migrations");

    // 3. Initialize Services Layer
    let study_service = Arc::new(StudyService::new(db.clone()));
    let deck_service = Arc::new(DeckService::new(db.clone()));
    let card_service = Arc::new(CardService::new(db.clone()));
    let pomodoro_service = Arc::new(PomodoroService::new(db.clone()));
    let analytics_service = Arc::new(AnalyticsService::new(db.clone()));
    let media_service = Arc::new(MediaService::new(db.clone()).expect("Failed to initialize MediaService"));
    let import_export_service = Arc::new(ImportExportService::new(db.clone()));
    let backup_service = Arc::new(BackupService::new(db.clone()).expect("Failed to initialize BackupService"));
    let tts_service = Arc::new(TtsService::new(db.clone(), media_service.clone()));

    let app_state = AppState {
        db,
        study_service,
        deck_service,
        card_service,
        pomodoro_service,
        analytics_service,
        media_service,
        import_export_service,
        backup_service,
        tts_service,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Decks
            get_decks_tree,
            get_all_decks,
            get_deck_by_id,
            create_deck,
            update_deck,
            delete_deck,
            // Cards
            get_card,
            create_card,
            update_card,
            delete_card,
            toggle_suspend_card,
            search_cards,
            get_weak_cards,
            // Study & Review
            get_study_queue,
            submit_review,
            start_study_session,
            end_study_session,
            get_daily_study_plan,
            // Pomodoro
            start_pomodoro,
            complete_pomodoro,
            get_pomodoro_config,
            save_pomodoro_config,
            // Analytics
            get_overall_stats,
            get_heatmap,
            get_review_history_chart,
            get_retention_trend_chart,
            // Tags
            get_all_tags,
            rename_tag,
            delete_tag,
            // Media
            upload_media,
            get_media_base64,
            // Import / Export / Backup
            preview_csv,
            import_csv,
            export_deck_json,
            import_json,
            create_backup,
            list_backups,
            // Settings
            get_app_settings,
            save_app_settings,
            // Text-to-Speech (TTS)
            tts_synthesize,
            tts_get_voices,
            tts_get_providers,
            tts_test_provider,
            tts_get_cache_stats,
            tts_clear_cache,
            tts_save_provider_credentials,
            tts_generate_bulk,
            tts_get_bulk_progress,
            tts_cancel_bulk,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lisan desktop application");
}
