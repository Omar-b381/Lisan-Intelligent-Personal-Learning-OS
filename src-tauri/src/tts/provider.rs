use crate::errors::AppResult;
use super::models::{Language, TtsRequest, Voice};

pub struct SynthesizedAudio {
    pub data: Vec<u8>,
    pub mime_type: &'static str,
    pub duration_ms: u32,
}

pub trait TtsProvider: Send + Sync {
    fn provider_name(&self) -> &'static str;
    
    fn is_available(&self) -> bool;

    fn supported_languages(&self) -> Vec<Language>;

    fn available_voices(&self, language: Option<&str>) -> AppResult<Vec<Voice>>;

    fn synthesize(&self, request: &TtsRequest) -> AppResult<SynthesizedAudio>;
}
