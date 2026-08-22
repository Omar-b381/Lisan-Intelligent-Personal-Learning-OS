use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProviderInput {
    pub provider_key: String,       // e.g. 'openai', 'anthropic', 'google', 'deepseek', 'groq', or 'custom_<id>'
    pub display_name: String,
    pub provider_type: String,      // 'preset' | 'custom'
    pub base_url: Option<String>,
    pub api_key: Option<String>,    // Raw key from input (will be encrypted on save)
    pub model_id: Option<String>,
    pub is_active: Option<bool>,
    pub is_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProviderDto {
    pub id: i64,
    pub provider_key: String,
    pub display_name: String,
    pub provider_type: String,
    pub base_url: Option<String>,
    pub model_id: Option<String>,
    pub has_key: bool,
    pub key_masked: String,
    pub is_active: bool,
    pub is_enabled: bool,
    pub last_test_status: String,
    pub last_test_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderTestResult {
    pub success: bool,
    pub status: String,
    pub message: String,
    pub latency_ms: u64,
    pub available_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeckFilterOption {
    pub id: String,
    pub name: String,
    pub card_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagFilterOption {
    pub name: String,
    pub card_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardFilterOption {
    pub id: String,
    pub front: String,
    pub back: String,
    pub deck_name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterOptionsDto {
    pub decks: Vec<DeckFilterOption>,
    pub tags: Vec<TagFilterOption>,
    pub specific_cards: Vec<CardFilterOption>,
    pub min_date_added: Option<String>,
    pub max_date_added: Option<String>,
    pub total_cards_count: u32,
    pub active_provider: Option<AiProviderDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeFilter {
    pub filter_type: String, // 'all_due' | 'deck' | 'tag' | 'specific_cards' | 'date_added' | 'combined'
    pub card_ids: Option<Vec<String>>,
    pub deck_id: Option<String>,
    pub tag: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub exclude_previously_practiced: Option<bool>,
    pub bypass_cache: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeQuestionDto {
    pub id: i64,
    pub session_id: i64,
    pub card_id: String,
    pub card_front: String,
    pub card_back: String,
    pub question_text: String,
    pub option_a: String,
    pub option_b: String,
    pub option_c: String,
    pub option_d: String,
    pub grounded_sentence: Option<String>,
    pub source_citation: Option<String>,
    pub source_url: Option<String>,
    pub is_source_verified: bool,
    pub user_answer: Option<String>,
    pub is_correct: Option<bool>,
    pub explanation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PracticeSessionDto {
    pub id: i64,
    pub provider_id: Option<i64>,
    pub provider_name: Option<String>,
    pub filter_type: String,
    pub question_count: u32,
    pub correct_count: u32,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub questions: Vec<PracticeQuestionDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerResultDto {
    pub question_id: i64,
    pub is_correct: bool,
    pub correct_option: String,
    pub explanation: String,
    pub user_answer: String,
    pub session_correct_count: u32,
    pub session_completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestionSummaryItem {
    pub id: i64,
    pub card_id: String,
    pub card_front: String,
    pub card_back: String,
    pub question_text: String,
    pub option_a: String,
    pub option_b: String,
    pub option_c: String,
    pub option_d: String,
    pub correct_option: String,
    pub user_answer: Option<String>,
    pub is_correct: Option<bool>,
    pub explanation: Option<String>,
    pub grounded_sentence: Option<String>,
    pub source_citation: Option<String>,
    pub source_url: Option<String>,
    pub is_source_verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummaryDto {
    pub session_id: i64,
    pub total_questions: u32,
    pub correct_count: u32,
    pub incorrect_count: u32,
    pub accuracy_percentage: f64,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub questions: Vec<QuestionSummaryItem>,
}

#[derive(Debug, Clone)]
pub struct ChatRequest {
    pub system_prompt: String,
    pub user_prompt: String,
    pub max_tokens: u32,
    pub json_mode: bool,
}

#[derive(Debug, Clone)]
pub struct ChatResponse {
    pub raw_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroundedExample {
    pub sentence: String,
    pub source_name: String,
    pub source_url: Option<String>,
    pub license_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedQuestionDraft {
    pub question: String,
    pub options: QuestionOptions,
    pub correct_option: String,
    pub explanation: String,
    pub used_grounded_sentence: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuestionOptions {
    pub a: String,
    pub b: String,
    pub c: String,
    pub d: String,
}
