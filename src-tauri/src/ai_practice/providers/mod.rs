pub mod openai;
pub mod anthropic;
pub mod google;
pub mod deepseek;
pub mod groq;
pub mod custom_openai_compatible;

use crate::errors::{AppError, AppResult};
use super::models::{ChatRequest, ChatResponse, ProviderTestResult};

pub trait AiProvider: Send + Sync {
    fn provider_key(&self) -> &str;
    fn test_connection(&self) -> AppResult<ProviderTestResult>;
    fn list_models(&self) -> AppResult<Vec<String>>;
    fn generate_chat(&self, req: &ChatRequest) -> AppResult<ChatResponse>;
}

pub fn create_provider(
    provider_key: &str,
    provider_type: &str,
    base_url: Option<&str>,
    api_key: &str,
    model_id: Option<&str>,
) -> AppResult<Box<dyn AiProvider>> {
    let clean_key = api_key.trim().to_string();
    let model = model_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    if provider_type == "custom" {
        let url = base_url
            .map(|u| u.trim().trim_end_matches('/').to_string())
            .ok_or_else(|| AppError::Validation("Base URL is required for custom AI provider".to_string()))?;
        return Ok(Box::new(custom_openai_compatible::CustomOpenAiCompatibleProvider::new(
            provider_key.to_string(),
            url,
            clean_key,
            model,
        )));
    }

    match provider_key {
        "openai" => Ok(Box::new(openai::OpenAiProvider::new(clean_key, model))),
        "anthropic" => Ok(Box::new(anthropic::AnthropicProvider::new(clean_key, model))),
        "google" => Ok(Box::new(google::GoogleGeminiProvider::new(clean_key, model))),
        "deepseek" => Ok(Box::new(deepseek::DeepSeekProvider::new(clean_key, model))),
        "groq" => Ok(Box::new(groq::GroqProvider::new(clean_key, model))),
        _ => {
            if let Some(url) = base_url {
                Ok(Box::new(custom_openai_compatible::CustomOpenAiCompatibleProvider::new(
                    provider_key.to_string(),
                    url.trim().trim_end_matches('/').to_string(),
                    clean_key,
                    model,
                )))
            } else {
                Err(AppError::Validation(format!("Unsupported preset AI provider: {}", provider_key)))
            }
        }
    }
}
