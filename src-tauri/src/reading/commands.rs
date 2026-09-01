use tauri::State;

use crate::commands::AppState;
use crate::domain::card::Card;
use crate::errors::AppError;
use super::reading_service::{BookDto, PassageDto};
use super::tts_alignment::AudioWithAlignmentDto;
use super::word_lookup::WordLookupResult;

#[tauri::command]
pub async fn reading_import_book(
    state: State<'_, AppState>,
    file_path: String,
    file_bytes_base64: Option<String>,
) -> Result<BookDto, AppError> {
    let reading_svc = state.reading_service.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let bytes = if let Some(b64) = file_bytes_base64 {
            let clean = if let Some(idx) = b64.find(',') {
                &b64[idx + 1..]
            } else {
                &b64
            };
            crate::commands::decode_base64(clean)
                .map_err(|e| AppError::Validation(format!("Invalid base64: {}", e)))?
        } else {
            std::fs::read(&file_path)
                .map_err(|e| AppError::Validation(format!("Failed to read file from path: {}", e)))?
        };

        reading_svc.import_book(&file_path, &bytes)
    })
    .await
    .map_err(|e| AppError::Internal(format!("Import task panicked: {}", e)))?
}

#[tauri::command]
pub async fn reading_list_books(state: State<'_, AppState>) -> Result<Vec<BookDto>, AppError> {
    state.reading_service.list_books()
}

#[tauri::command]
pub async fn reading_get_passage(
    state: State<'_, AppState>,
    book_id: i64,
    passage_index: i64,
) -> Result<PassageDto, AppError> {
    state.reading_service.get_passage(book_id, passage_index)
}

#[tauri::command]
pub async fn reading_save_progress(
    state: State<'_, AppState>,
    book_id: i64,
    passage_index: i64,
) -> Result<(), AppError> {
    state.reading_service.save_progress(book_id, passage_index)
}

#[tauri::command]
pub async fn reading_lookup_word(
    state: State<'_, AppState>,
    word: String,
    context_sentence: String,
) -> Result<WordLookupResult, AppError> {
    let reading_svc = state.reading_service.clone();
    tauri::async_runtime::spawn_blocking(move || {
        reading_svc.lookup_word(&word, &context_sentence)
    })
    .await
    .map_err(|e| AppError::Internal(format!("Lookup task panicked: {}", e)))?
}

#[tauri::command]
pub async fn reading_add_word_to_review(
    state: State<'_, AppState>,
    passage_id: i64,
    word: String,
    sentence: String,
) -> Result<Card, AppError> {
    let reading_svc = state.reading_service.clone();
    tauri::async_runtime::spawn_blocking(move || {
        reading_svc.create_card_from_tap(passage_id, &word, &sentence)
    })
    .await
    .map_err(|e| AppError::Internal(format!("Create card task panicked: {}", e)))?
}

#[tauri::command]
pub async fn reading_synthesize_passage_audio(
    state: State<'_, AppState>,
    passage_id: i64,
    preferred_provider: Option<String>,
    preferred_voice: Option<String>,
) -> Result<AudioWithAlignmentDto, AppError> {
    let tts_svc = state.tts_service.clone();
    let db = state.db.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let conn = db.get_connection();
        let text: String = conn.query_row(
            "SELECT raw_text FROM passages WHERE id = ?1",
            rusqlite::params![passage_id],
            |r| r.get(0),
        ).map_err(|_| AppError::NotFound(format!("Passage #{} not found", passage_id)))?;
        drop(conn);

        super::tts_alignment::TtsAlignmentService::synthesize_passage(
            &tts_svc,
            &db,
            &text,
            preferred_provider.as_deref(),
            preferred_voice.as_deref(),
        )
    })
    .await
    .map_err(|e| AppError::Internal(format!("TTS alignment task panicked: {}", e)))?
}

#[tauri::command]
pub async fn reading_delete_book(
    state: State<'_, AppState>,
    book_id: i64,
) -> Result<(), AppError> {
    state.reading_service.delete_book(book_id)
}
