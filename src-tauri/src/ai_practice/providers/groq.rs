use std::time::{Duration, Instant};
use serde_json::json;
use crate::errors::{AppError, AppResult};
use super::AiProvider;
use crate::ai_practice::models::{ChatRequest, ChatResponse, ProviderTestResult};

pub struct GroqProvider {
    api_key: String,
    model_id: Option<String>,
}

impl GroqProvider {
    pub fn new(api_key: String, model_id: Option<String>) -> Self {
        Self { api_key, model_id }
    }

    fn get_model(&self) -> &str {
        self.model_id.as_deref().unwrap_or("llama-3.3-70b-versatile")
    }
}

impl AiProvider for GroqProvider {
    fn provider_key(&self) -> &'static str {
        "groq"
    }

    fn test_connection(&self) -> AppResult<ProviderTestResult> {
        if self.api_key.trim().is_empty() {
            return Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: "يرجى إدخال مفتاح Groq API أولاً".to_string(),
                latency_ms: 0,
                available_models: vec![],
            });
        }

        let start = Instant::now();
        let resp = ureq::get("https://api.groq.com/openai/v1/models")
            .set("Authorization", &format!("Bearer {}", self.api_key.trim()))
            .timeout(Duration::from_secs(12))
            .call();

        let latency_ms = start.elapsed().as_millis() as u64;

        match resp {
            Ok(r) => {
                let models: Vec<String> = if let Ok(j) = r.into_json::<serde_json::Value>() {
                    j["data"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m["id"].as_str())
                                .filter(|id| !id.contains("whisper") && !id.contains("embed"))
                                .map(|s| s.to_string())
                                .collect()
                        })
                        .unwrap_or_default()
                } else {
                    vec!["llama-3.3-70b-versatile".to_string(), "llama-3.1-8b-instant".to_string()]
                };

                Ok(ProviderTestResult {
                    success: true,
                    status: "ok".to_string(),
                    message: "تم الاتصال بنجاح بمزود Groq فائق السرعة!".to_string(),
                    latency_ms,
                    available_models: models,
                })
            }
            Err(ureq::Error::Status(401, _)) => Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: "مفتاح Groq API غير صحيح (401 Unauthorized)".to_string(),
                latency_ms,
                available_models: vec![],
            }),
            Err(ureq::Error::Status(429, _)) => Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: "تم تجاوز حد الاستدعاءات في Groq (429 Rate Limit Exceeded)".to_string(),
                latency_ms,
                available_models: vec![],
            }),
            Err(e) => Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: format!("فشل الاتصال بـ Groq: {}", e),
                latency_ms,
                available_models: vec![],
            }),
        }
    }

    fn list_models(&self) -> AppResult<Vec<String>> {
        let resp = ureq::get("https://api.groq.com/openai/v1/models")
            .set("Authorization", &format!("Bearer {}", self.api_key.trim()))
            .timeout(Duration::from_secs(10))
            .call();

        match resp {
            Ok(r) => {
                if let Ok(j) = r.into_json::<serde_json::Value>() {
                    let mut list: Vec<String> = j["data"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m["id"].as_str())
                                .filter(|id| !id.contains("whisper") && !id.contains("embed"))
                                .map(|s| s.to_string())
                                .collect()
                        })
                        .unwrap_or_default();
                    list.sort();
                    if !list.is_empty() {
                        return Ok(list);
                    }
                }
                Ok(vec![
                    "llama-3.3-70b-versatile".to_string(),
                    "llama-3.1-8b-instant".to_string(),
                    "mixtral-8x7b-32768".to_string(),
                ])
            }
            Err(_) => Ok(vec![
                "llama-3.3-70b-versatile".to_string(),
                "llama-3.1-8b-instant".to_string(),
                "mixtral-8x7b-32768".to_string(),
            ]),
        }
    }

    fn generate_chat(&self, req: &ChatRequest) -> AppResult<ChatResponse> {
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

        let resp = ureq::post("https://api.groq.com/openai/v1/chat/completions")
            .set("Authorization", &format!("Bearer {}", self.api_key.trim()))
            .set("Content-Type", "application/json")
            .timeout(Duration::from_secs(30))
            .send_json(&body);

        match resp {
            Ok(r) => {
                let j: serde_json::Value = r.into_json()
                    .map_err(|e| AppError::Internal(format!("Failed to parse Groq JSON response: {}", e)))?;

                let content = j["choices"][0]["message"]["content"]
                    .as_str()
                    .ok_or_else(|| AppError::Internal("Missing content in Groq response".to_string()))?
                    .to_string();

                Ok(ChatResponse { raw_text: content })
            }
            Err(ureq::Error::Status(code, r)) => {
                let err_body = r.into_string().unwrap_or_default();
                Err(AppError::Internal(format!("Groq API error ({code}): {err_body}")))
            }
            Err(e) => Err(AppError::Internal(format!("Groq network request failed: {e}"))),
        }
    }
}
