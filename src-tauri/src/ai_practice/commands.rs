use tauri::State;
use crate::commands::AppState;
use crate::errors::AppError;
use super::models::*;

#[tauri::command]
pub async fn ai_provider_save(
    state: State<'_, AppState>,
    input: AiProviderInput,
) -> Result<AiProviderDto, AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.save_provider(input))
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_provider_test(
    state: State<'_, AppState>,
    provider_id: i64,
) -> Result<ProviderTestResult, AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.test_provider(provider_id))
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_provider_list_models(
    state: State<'_, AppState>,
    provider_id: i64,
) -> Result<Vec<String>, AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.list_models(provider_id))
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_provider_list(
    state: State<'_, AppState>,
) -> Result<Vec<AiProviderDto>, AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.list_providers())
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_provider_set_active(
    state: State<'_, AppState>,
    provider_id: i64,
) -> Result<(), AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.set_active_provider(provider_id))
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_provider_delete(
    state: State<'_, AppState>,
    provider_id: i64,
) -> Result<(), AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.delete_provider(provider_id))
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_practice_get_filter_options(
    state: State<'_, AppState>,
) -> Result<FilterOptionsDto, AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.get_filter_options())
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_practice_start_session(
    state: State<'_, AppState>,
    filter: PracticeFilter,
    question_count: u32,
) -> Result<PracticeSessionDto, AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.start_session(filter, question_count))
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_practice_submit_answer(
    state: State<'_, AppState>,
    question_id: i64,
    chosen: String,
) -> Result<AnswerResultDto, AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.submit_answer(question_id, chosen))
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_practice_get_summary(
    state: State<'_, AppState>,
    session_id: i64,
) -> Result<SessionSummaryDto, AppError> {
    let svc = state.ai_practice_service.clone();
    tauri::async_runtime::spawn_blocking(move || svc.get_summary(session_id))
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn ai_practice_list_history(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<PracticeSessionDto>, AppError> {
    let svc = state.ai_practice_service.clone();
    let lim = limit.unwrap_or(20);
    tauri::async_runtime::spawn_blocking(move || svc.list_history(lim))
        .await
        .map_err(|e| AppError::Internal(format!("AI Practice thread join error: {}", e)))?
}

#[tauri::command]
pub async fn generate_distractors(
    state: State<'_, AppState>,
    word: String,
    count: u8,
) -> Result<Vec<String>, String> {
    let svc = state.distractor_service.clone();
    tauri::async_runtime::spawn_blocking(move || {
        Ok(svc.get_distractors(&word, count))
    })
    .await
    .map_err(|e| format!("Distractor generation thread error: {}", e))?
}

