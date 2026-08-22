use std::sync::Arc;
use tauri::State;

use crate::database::connection::Database;
use crate::database::repositories::{SettingsRepository, TagRepository};
use crate::domain::card::{Card, CardStudyItem, CardWithDeckInfo, CreateCardDto, UpdateCardDto};
use crate::domain::deck::{CreateDeckDto, Deck, DeckWithStats, UpdateDeckDto};
use crate::domain::pomodoro::{PomodoroConfig, PomodoroMode, PomodoroSession, PomodoroSessionSummary};
use crate::domain::review::{ReviewResult, SubmitReviewDto};
use crate::domain::session::{ChartDataPoint, DailyStudyPlan, HeatmapDay, OverallStats, StudySession, WeakCardInfo};
use crate::domain::settings::AppSettings;
use crate::domain::tag::TagStats;
use crate::errors::AppError;
use crate::services::*;
use crate::tts::models::*;

pub use crate::ai_practice::commands::*;

pub struct AppState {
    pub db: Database,
    pub study_service: Arc<StudyService>,
    pub deck_service: Arc<DeckService>,
    pub card_service: Arc<CardService>,
    pub pomodoro_service: Arc<PomodoroService>,
    pub analytics_service: Arc<AnalyticsService>,
    pub media_service: Arc<MediaService>,
    pub import_export_service: Arc<ImportExportService>,
    pub backup_service: Arc<BackupService>,
    pub tts_service: Arc<TtsService>,
    pub ai_practice_service: Arc<crate::ai_practice::AiPracticeService>,
}

// ---------------- Decks Commands ----------------

#[tauri::command]
pub async fn get_decks_tree(state: State<'_, AppState>) -> Result<Vec<DeckWithStats>, AppError> {
    state.deck_service.get_decks_tree()
}

#[tauri::command]
pub async fn get_all_decks(state: State<'_, AppState>) -> Result<Vec<Deck>, AppError> {
    state.deck_service.get_all_flat()
}

#[tauri::command]
pub async fn get_deck_by_id(state: State<'_, AppState>, id: String) -> Result<Deck, AppError> {
    state.deck_service.get_by_id(&id)
}

#[tauri::command]
pub async fn create_deck(state: State<'_, AppState>, dto: CreateDeckDto) -> Result<Deck, AppError> {
    state.deck_service.create_deck(dto)
}

#[tauri::command]
pub async fn update_deck(state: State<'_, AppState>, dto: UpdateDeckDto) -> Result<Deck, AppError> {
    state.deck_service.update_deck(dto)
}

#[tauri::command]
pub async fn delete_deck(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.deck_service.delete_deck(&id)
}

// ---------------- Cards Commands ----------------

#[tauri::command]
pub async fn get_card(state: State<'_, AppState>, id: String) -> Result<Card, AppError> {
    state.card_service.get_card(&id)
}

#[tauri::command]
pub async fn create_card(state: State<'_, AppState>, dto: CreateCardDto) -> Result<Card, AppError> {
    state.card_service.create_card(dto)
}

#[tauri::command]
pub async fn update_card(state: State<'_, AppState>, dto: UpdateCardDto) -> Result<Card, AppError> {
    state.card_service.update_card(dto)
}

#[tauri::command]
pub async fn delete_card(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    state.card_service.delete_card(&id)
}

#[tauri::command]
pub async fn toggle_suspend_card(state: State<'_, AppState>, id: String) -> Result<bool, AppError> {
    state.card_service.toggle_suspend(&id)
}

#[tauri::command]
pub async fn search_cards(
    state: State<'_, AppState>,
    query: String,
    deck_id: Option<String>,
    tag: Option<String>,
    card_state: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<CardWithDeckInfo>, AppError> {
    state.card_service.search_cards(
        &query,
        deck_id.as_deref(),
        tag.as_deref(),
        card_state.as_deref(),
        limit.unwrap_or(50),
        offset.unwrap_or(0),
    )
}

#[tauri::command]
pub async fn get_weak_cards(state: State<'_, AppState>, limit: Option<u32>) -> Result<Vec<WeakCardInfo>, AppError> {
    state.card_service.get_weak_cards(limit)
}

// ---------------- Study Commands ----------------

#[tauri::command]
pub async fn get_study_queue(
    state: State<'_, AppState>,
    deck_id: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<CardStudyItem>, AppError> {
    state.study_service.get_study_queue(deck_id, limit)
}

#[tauri::command]
pub async fn submit_review(
    state: State<'_, AppState>,
    dto: SubmitReviewDto,
) -> Result<ReviewResult, AppError> {
    state.study_service.submit_review(dto)
}

#[tauri::command]
pub async fn start_study_session(
    state: State<'_, AppState>,
    deck_id: Option<String>,
    pomodoro_id: Option<String>,
) -> Result<StudySession, AppError> {
    state.study_service.start_study_session(deck_id, pomodoro_id)
}

#[tauri::command]
pub async fn end_study_session(state: State<'_, AppState>, session_id: String) -> Result<StudySession, AppError> {
    state.study_service.end_study_session(&session_id)
}

#[tauri::command]
pub async fn get_daily_study_plan(state: State<'_, AppState>) -> Result<DailyStudyPlan, AppError> {
    state.study_service.get_daily_study_plan()
}

// ---------------- Pomodoro Commands ----------------

#[tauri::command]
pub async fn start_pomodoro(
    state: State<'_, AppState>,
    mode: PomodoroMode,
    target_duration_secs: u32,
) -> Result<PomodoroSession, AppError> {
    state.pomodoro_service.start_pomodoro(mode, target_duration_secs)
}

#[tauri::command]
pub async fn complete_pomodoro(
    state: State<'_, AppState>,
    id: String,
    actual_duration_secs: u32,
) -> Result<PomodoroSessionSummary, AppError> {
    state.pomodoro_service.complete_pomodoro(&id, actual_duration_secs)
}

#[tauri::command]
pub async fn get_pomodoro_config(state: State<'_, AppState>) -> Result<PomodoroConfig, AppError> {
    state.pomodoro_service.get_config()
}

#[tauri::command]
pub async fn save_pomodoro_config(
    state: State<'_, AppState>,
    config: PomodoroConfig,
) -> Result<(), AppError> {
    state.pomodoro_service.save_config(config)
}

// ---------------- Analytics Commands ----------------

#[tauri::command]
pub async fn get_overall_stats(state: State<'_, AppState>) -> Result<OverallStats, AppError> {
    state.analytics_service.get_overall_stats()
}

#[tauri::command]
pub async fn get_heatmap(state: State<'_, AppState>) -> Result<Vec<HeatmapDay>, AppError> {
    state.analytics_service.get_heatmap()
}

#[tauri::command]
pub async fn get_review_history_chart(
    state: State<'_, AppState>,
    days: Option<u32>,
) -> Result<Vec<ChartDataPoint>, AppError> {
    state.analytics_service.get_review_history_chart(days)
}

#[tauri::command]
pub async fn get_retention_trend_chart(
    state: State<'_, AppState>,
    days: Option<u32>,
) -> Result<Vec<ChartDataPoint>, AppError> {
    state.analytics_service.get_retention_trend_chart(days)
}

// ---------------- Tags Commands ----------------

#[tauri::command]
pub async fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<TagStats>, AppError> {
    let conn = state.db.get_connection();
    TagRepository::get_all(&conn)
}

#[tauri::command]
pub async fn rename_tag(state: State<'_, AppState>, id: String, new_name: String) -> Result<(), AppError> {
    let conn = state.db.get_connection();
    TagRepository::rename(&conn, &id, &new_name)
}

#[tauri::command]
pub async fn delete_tag(state: State<'_, AppState>, id: String) -> Result<(), AppError> {
    let conn = state.db.get_connection();
    TagRepository::delete(&conn, &id)
}

// ---------------- Media Commands ----------------

#[tauri::command]
pub async fn upload_media(
    state: State<'_, AppState>,
    original_name: String,
    data_base64: String,
    mime_type: String,
) -> Result<crate::domain::media::MediaItem, AppError> {
    // decode base64
    let clean_base64 = if let Some(idx) = data_base64.find(',') {
        &data_base64[idx + 1..]
    } else {
        &data_base64
    };

    let bytes = decode_base64(clean_base64)
        .map_err(|e| AppError::Media(format!("Invalid base64 data: {}", e)))?;

    state.media_service.add_media(&original_name, &bytes, &mime_type)
}

#[tauri::command]
pub async fn get_media_base64(state: State<'_, AppState>, filename: String) -> Result<String, AppError> {
    state.media_service.get_media_base64(&filename)
}

// ---------------- Import / Export / Backup ----------------

#[tauri::command]
pub async fn preview_csv(
    state: State<'_, AppState>,
    content: String,
    delimiter: Option<String>,
) -> Result<import_export_service::ImportPreview, AppError> {
    let delim_byte = delimiter.as_deref().and_then(|d| d.bytes().next()).unwrap_or(b',');
    state.import_export_service.preview_csv(&content, delim_byte)
}

#[tauri::command]
pub async fn import_csv(
    state: State<'_, AppState>,
    deck_id: String,
    content: String,
    delimiter: Option<String>,
) -> Result<usize, AppError> {
    let delim_byte = delimiter.as_deref().and_then(|d| d.bytes().next()).unwrap_or(b',');
    state.import_export_service.import_csv(&deck_id, &content, delim_byte)
}

#[tauri::command]
pub async fn export_deck_json(state: State<'_, AppState>, deck_id: String) -> Result<String, AppError> {
    state.import_export_service.export_deck_json(&deck_id)
}

#[tauri::command]
pub async fn import_json(
    state: State<'_, AppState>,
    json_content: String,
    target_deck_id: Option<String>,
) -> Result<usize, AppError> {
    state.import_export_service.import_json(&json_content, target_deck_id)
}

#[tauri::command]
pub async fn create_backup(state: State<'_, AppState>) -> Result<backup_service::BackupFileInfo, AppError> {
    state.backup_service.create_backup()
}

#[tauri::command]
pub async fn list_backups(state: State<'_, AppState>) -> Result<Vec<backup_service::BackupFileInfo>, AppError> {
    state.backup_service.list_backups()
}

// ---------------- Settings Commands ----------------

#[tauri::command]
pub async fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    let conn = state.db.get_connection();
    SettingsRepository::get_app_settings(&conn)
}

#[tauri::command]
pub async fn save_app_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), AppError> {
    let conn = state.db.get_connection();
    SettingsRepository::save_app_settings(&conn, &settings)
}

// ---------------- Text-to-Speech (TTS) Commands ----------------

#[tauri::command]
pub async fn tts_synthesize(state: State<'_, AppState>, request: TtsRequest) -> Result<TtsResult, AppError> {
    let svc = state.tts_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.synthesize(request))
        .await
        .map_err(|e| AppError::Internal(format!("TTS thread join error: {}", e)))?
}

#[tauri::command]
pub async fn tts_get_voices(
    state: State<'_, AppState>,
    provider: Option<String>,
    language: Option<String>,
) -> Result<Vec<Voice>, AppError> {
    let svc = state.tts_service.clone();
    tauri::async_runtime::spawn_blocking(move || {
        svc.get_available_voices(provider.as_deref(), language.as_deref())
    })
    .await
    .map_err(|e| AppError::Internal(format!("TTS thread join error: {}", e)))?
}

#[tauri::command]
pub async fn tts_get_providers(state: State<'_, AppState>) -> Result<Vec<ProviderInfo>, AppError> {
    let svc = state.tts_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.get_providers())
        .await
        .map_err(|e| AppError::Internal(format!("TTS thread join error: {}", e)))?
}

#[tauri::command]
pub async fn tts_test_provider(
    state: State<'_, AppState>,
    provider: String,
    api_key: Option<String>,
) -> Result<TtsResult, AppError> {
    let svc = state.tts_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.test_provider(&provider, api_key.as_deref()))
        .await
        .map_err(|e| AppError::Internal(format!("TTS thread join error: {}", e)))?
}

#[tauri::command]
pub async fn tts_get_cache_stats(state: State<'_, AppState>) -> Result<TtsCacheStats, AppError> {
    state.tts_service.get_cache_stats()
}

#[tauri::command]
pub async fn tts_clear_cache(state: State<'_, AppState>, unused_only: Option<bool>) -> Result<usize, AppError> {
    state.tts_service.clear_cache(unused_only.unwrap_or(false))
}

#[tauri::command]
pub async fn tts_save_provider_credentials(
    state: State<'_, AppState>,
    provider: String,
    api_key: String,
) -> Result<(), AppError> {
    state.tts_service.save_provider_credentials(&provider, &api_key)
}

#[tauri::command]
pub async fn tts_verify_elevenlabs_account(
    state: State<'_, AppState>,
    api_key: Option<String>,
) -> Result<crate::tts::models::ElevenLabsAccountInfo, AppError> {
    let svc = state.tts_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.verify_elevenlabs_account(api_key.as_deref()))
        .await
        .map_err(|e| AppError::Internal(format!("TTS thread join error: {}", e)))?
}

#[tauri::command]
pub async fn tts_generate_bulk(
    state: State<'_, AppState>,
    request: BulkGenerationRequest,
) -> Result<String, AppError> {
    state.tts_service.start_bulk_generation(request)
}

#[tauri::command]
pub async fn tts_get_bulk_progress(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<Option<BulkGenerationProgress>, AppError> {
    Ok(state.tts_service.get_bulk_progress(&task_id))
}

#[tauri::command]
pub async fn tts_cancel_bulk(state: State<'_, AppState>, task_id: String) -> Result<(), AppError> {
    state.tts_service.cancel_bulk(&task_id);
    Ok(())
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
