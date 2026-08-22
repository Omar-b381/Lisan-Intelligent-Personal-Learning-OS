use std::time::{Duration, Instant};
use serde_json::json;
use crate::errors::{AppError, AppResult};
use super::AiProvider;
use crate::ai_practice::models::{ChatRequest, ChatResponse, ProviderTestResult};

pub struct CustomOpenAiCompatibleProvider {
    provider_key: String,
    base_url: String,
    api_key: String,
    model_id: Option<String>,
}

impl CustomOpenAiCompatibleProvider {
    pub fn new(
        provider_key: String,
        base_url: String,
        api_key: String,
        model_id: Option<String>,
    ) -> Self {
        Self {
            provider_key,
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key,
            model_id,
        }
    }

    fn get_model(&self) -> &str {
        self.model_id.as_deref().unwrap_or("default")
    }

    fn apply_auth(&self, req: ureq::Request) -> ureq::Request {
        let clean_key = self.api_key.trim();
        if !clean_key.is_empty() {
            req.set("Authorization", &format!("Bearer {}", clean_key))
        } else {
            req
        }
    }
}

impl AiProvider for CustomOpenAiCompatibleProvider {
    fn provider_key(&self) -> &str {
        &self.provider_key
    }

    fn test_connection(&self) -> AppResult<ProviderTestResult> {
        let start = Instant::now();
        let models_url = format!("{}/models", self.base_url);

        let req = ureq::get(&models_url).timeout(Duration::from_secs(10));
        let resp = self.apply_auth(req).call();

        let latency_ms = start.elapsed().as_millis() as u64;

        match resp {
            Ok(r) => {
                let models: Vec<String> = if let Ok(j) = r.into_json::<serde_json::Value>() {
                    j["data"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m["id"].as_str())
                                .map(|s| s.to_string())
                                .collect()
                        })
                        .unwrap_or_default()
                } else {
                    vec![]
                };

                Ok(ProviderTestResult {
                    success: true,
                    status: "ok".to_string(),
                    message: "تم الاتصال بنجاح بالخادم المخصص!".to_string(),
                    latency_ms,
                    available_models: models,
                })
            }
            Err(_e) => {
                // If /models failed, try a minimal completion test
                let chat_url = format!("{}/chat/completions", self.base_url);
                let body = json!({
                    "model": self.get_model(),
                    "messages": [{ "role": "user", "content": "Hi" }],
                    "max_tokens": 5
                });

                let chat_req = ureq::post(&chat_url)
                    .set("Content-Type", "application/json")
                    .timeout(Duration::from_secs(12));
                let chat_resp = self.apply_auth(chat_req).send_json(&body);

                let retry_latency = start.elapsed().as_millis() as u64;

                match chat_resp {
                    Ok(_) => Ok(ProviderTestResult {
                        success: true,
                        status: "ok".to_string(),
                        message: "تم الاتصال بنجاح بالخادم المخصص عبر نقطة chat/completions!".to_string(),
                        latency_ms: retry_latency,
                        available_models: vec![],
                    }),
                    Err(err) => Ok(ProviderTestResult {
                        success: false,
                        status: "failed".to_string(),
                        message: format!("فشل الاتصال بالخادم المخصص ({}/chat/completions): {}", self.base_url, err),
                        latency_ms: retry_latency,
                        available_models: vec![],
                    }),
                }
            }
        }
    }

    fn list_models(&self) -> AppResult<Vec<String>> {
        let models_url = format!("{}/models", self.base_url);
        let req = ureq::get(&models_url).timeout(Duration::from_secs(8));
        let resp = self.apply_auth(req).call();

        match resp {
            Ok(r) => {
                if let Ok(j) = r.into_json::<serde_json::Value>() {
                    let list: Vec<String> = j["data"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m["id"].as_str())
                                .map(|s| s.to_string())
                                .collect()
                        })
                        .unwrap_or_default();
                    return Ok(list);
                }
                Ok(vec![])
            }
            Err(_) => Ok(vec![]),
        }
    }

    fn generate_chat(&self, req: &ChatRequest) -> AppResult<ChatResponse> {
        let chat_url = format!("{}/chat/completions", self.base_url);
        let model = self.get_model();
        let mut body = json!({
            "model": model,
            "messages": [
                { "role": "system", "content": req.system_prompt },
                { "role": "user", "content": req.user_prompt }
            ],
            "max_tokens": req.max_tokens,
            "temperature": 0.7,
        });

        if req.json_mode {
            body["response_format"] = json!({ "type": "json_object" });
        }

        let post_req = ureq::post(&chat_url)
            .set("Content-Type", "application/json")
            .timeout(Duration::from_secs(45));

        let resp = self.apply_auth(post_req).send_json(&body);

        match resp {
            Ok(r) => {
                let j: serde_json::Value = r.into_json()
                    .map_err(|e| AppError::Internal(format!("Failed to parse custom provider JSON: {}", e)))?;

                let content = j["choices"][0]["message"]["content"]
                    .as_str()
                    .ok_or_else(|| AppError::Internal("Missing message content in custom provider response".to_string()))?
                    .to_string();

                Ok(ChatResponse { raw_text: content })
            }
            Err(ureq::Error::Status(code, r)) => {
                let err_body = r.into_string().unwrap_or_default();
                Err(AppError::Internal(format!("Custom AI server error ({code}): {err_body}")))
            }
            Err(e) => Err(AppError::Internal(format!("Custom AI server connection failed: {e}"))),
        }
    }
}
