use std::time::{Duration, Instant};
use serde_json::json;
use crate::errors::{AppError, AppResult};
use super::AiProvider;
use crate::ai_practice::models::{ChatRequest, ChatResponse, ProviderTestResult};

pub struct AnthropicProvider {
    api_key: String,
    model_id: Option<String>,
}

impl AnthropicProvider {
    pub fn new(api_key: String, model_id: Option<String>) -> Self {
        Self { api_key, model_id }
    }

    fn get_model(&self) -> &str {
        self.model_id.as_deref().unwrap_or("claude-3-5-haiku-latest")
    }
}

impl AiProvider for AnthropicProvider {
    fn provider_key(&self) -> &'static str {
        "anthropic"
    }

    fn test_connection(&self) -> AppResult<ProviderTestResult> {
        if self.api_key.trim().is_empty() {
            return Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: "يرجى إدخال مفتاح Anthropic API أولاً".to_string(),
                latency_ms: 0,
                available_models: vec![],
            });
        }

        let start = Instant::now();
        let body = json!({
            "model": "claude-3-5-haiku-latest",
            "max_tokens": 5,
            "messages": [{ "role": "user", "content": "Hi" }]
        });

        let resp = ureq::post("https://api.anthropic.com/v1/messages")
            .set("x-api-key", self.api_key.trim())
            .set("anthropic-version", "2023-06-01")
            .set("Content-Type", "application/json")
            .timeout(Duration::from_secs(12))
            .send_json(&body);

        let latency_ms = start.elapsed().as_millis() as u64;

        match resp {
            Ok(_) => Ok(ProviderTestResult {
                success: true,
                status: "ok".to_string(),
                message: "تم الاتصال بنجاح بمزود Anthropic (Claude)!".to_string(),
                latency_ms,
                available_models: vec![
                    "claude-3-5-haiku-latest".to_string(),
                    "claude-3-5-sonnet-latest".to_string(),
                    "claude-3-opus-latest".to_string(),
                ],
            }),
            Err(ureq::Error::Status(401, _)) => Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: "مفتاح Anthropic API غير صحيح (401 Unauthorized)".to_string(),
                latency_ms,
                available_models: vec![],
            }),
            Err(ureq::Error::Status(429, _)) => Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: "تم تجاوز حد الاستدعاءات في Anthropic (429 Rate Limit Exceeded)".to_string(),
                latency_ms,
                available_models: vec![],
            }),
            Err(e) => Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: format!("فشل الاتصال بـ Anthropic: {}", e),
                latency_ms,
                available_models: vec![],
            }),
        }
    }

    fn list_models(&self) -> AppResult<Vec<String>> {
        // Anthropic models
        Ok(vec![
            "claude-3-5-haiku-latest".to_string(),
            "claude-3-5-sonnet-latest".to_string(),
            "claude-3-opus-latest".to_string(),
            "claude-3-haiku-20240307".to_string(),
        ])
    }

    fn generate_chat(&self, req: &ChatRequest) -> AppResult<ChatResponse> {
        let model = self.get_model();
        let body = json!({
            "model": model,
            "max_tokens": req.max_tokens,
            "system": req.system_prompt,
            "messages": [
                { "role": "user", "content": req.user_prompt }
            ],
            "temperature": 0.7
        });

        let resp = ureq::post("https://api.anthropic.com/v1/messages")
            .set("x-api-key", self.api_key.trim())
            .set("anthropic-version", "2023-06-01")
            .set("Content-Type", "application/json")
            .timeout(Duration::from_secs(30))
            .send_json(&body);

        match resp {
            Ok(r) => {
                let raw_body = r.into_string().unwrap_or_default();
                if raw_body.trim().is_empty() {
                    return Err(AppError::Internal("Received empty response from Anthropic API".to_string()));
                }
                let j: serde_json::Value = serde_json::from_str(&raw_body)
                    .map_err(|e| AppError::Internal(format!("Failed to parse Anthropic JSON response: {e}")))?;

                let content = j["content"][0]["text"]
                    .as_str()
                    .ok_or_else(|| AppError::Internal("Missing text in Anthropic response".to_string()))?
                    .to_string();

                Ok(ChatResponse { raw_text: content })
            }
            Err(ureq::Error::Status(code, r)) => {
                let err_body = r.into_string().unwrap_or_default();
                Err(AppError::Internal(format!("Anthropic API error ({code}): {err_body}")))
            }
            Err(e) => Err(AppError::Internal(format!("Anthropic network request failed: {e}"))),
        }
    }
}
