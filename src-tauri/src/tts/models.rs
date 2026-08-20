use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsRequest {
    pub text: String,
    pub language: Option<String>,
    pub provider: Option<String>, // "system" | "google" | "elevenlabs"
    pub voice: Option<String>,
    pub speed: Option<f64>, // 0.5 to 2.0 (default: 1.0)
    pub pitch: Option<f64>, // 0.5 to 2.0 (default: 1.0)
    pub output_format: Option<String>, // "mp3" | "wav" | "ogg"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsResult {
    pub id: String,
    pub text_hash: String,
    pub text: String,
    pub language: String,
    pub provider: String,
    pub voice: String,
    pub speed: f64,
    pub pitch: f64,
    pub file_path: String,
    pub base64_data: Option<String>,
    pub mime_type: String,
    pub file_size: u64,
    pub duration_ms: u32,
    pub cached: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Voice {
    pub id: String,
    pub name: String,
    pub language: String,
    pub gender: Option<String>, // "male" | "female" | "neutral"
    pub provider: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Language {
    pub code: String,
    pub display_name: String,
    pub native_name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TtsProviderType {
    System,
    Google,
    ElevenLabs,
}

impl TtsProviderType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TtsProviderType::System => "system",
            TtsProviderType::Google => "google",
            TtsProviderType::ElevenLabs => "elevenlabs",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "google" => TtsProviderType::Google,
            "elevenlabs" => TtsProviderType::ElevenLabs,
            _ => TtsProviderType::System,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_configured: bool,
    pub requires_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsCacheStats {
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub total_plays: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkGenerationRequest {
    pub deck_id: String,
    pub provider: Option<String>,
    pub voice: Option<String>,
    pub speed: Option<f64>,
    pub only_missing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkGenerationProgress {
    pub task_id: String,
    pub deck_id: String,
    pub total_cards: usize,
    pub processed_cards: usize,
    pub current_word: String,
    pub status: String, // "idle" | "running" | "paused" | "completed" | "cancelled" | "failed"
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TtsAudioRecord {
    pub id: String,
    pub text_hash: String,
    pub text: String,
    pub language: String,
    pub provider: String,
    pub voice: String,
    pub speed: f64,
    pub pitch: f64,
    pub file_path: String,
    pub mime_type: String,
    pub file_size: u64,
    pub duration_ms: u32,
    pub play_count: u64,
    pub last_used_at: String,
    pub created_at: String,
}
