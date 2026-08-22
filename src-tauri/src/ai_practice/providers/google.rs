use std::time::{Duration, Instant};
use serde_json::json;
use crate::errors::{AppError, AppResult};
use super::AiProvider;
use crate::ai_practice::models::{ChatRequest, ChatResponse, ProviderTestResult};

pub struct GoogleGeminiProvider {
    api_key: String,
    model_id: Option<String>,
}

impl GoogleGeminiProvider {
    pub fn new(api_key: String, model_id: Option<String>) -> Self {
        Self { api_key, model_id }
    }

    fn get_model(&self) -> &str {
        self.model_id.as_deref().unwrap_or("gemini-1.5-flash")
    }
}

impl AiProvider for GoogleGeminiProvider {
    fn provider_key(&self) -> &'static str {
        "google"
    }

    fn test_connection(&self) -> AppResult<ProviderTestResult> {
        if self.api_key.trim().is_empty() {
            return Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: "يرجى إدخال مفتاح Google Gemini API أولاً".to_string(),
                latency_ms: 0,
                available_models: vec![],
            });
        }

        let start = Instant::now();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            self.api_key.trim()
        );

        let resp = ureq::get(&url)
            .timeout(Duration::from_secs(12))
            .call();

        let latency_ms = start.elapsed().as_millis() as u64;

        match resp {
            Ok(r) => {
                let models: Vec<String> = if let Ok(j) = r.into_json::<serde_json::Value>() {
                    j["models"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m["name"].as_str())
                                .filter(|name| name.contains("gemini"))
                                .map(|name| name.trim_start_matches("models/").to_string())
                                .collect()
                        })
                        .unwrap_or_default()
                } else {
                    vec!["gemini-1.5-flash".to_string(), "gemini-1.5-pro".to_string(), "gemini-2.0-flash".to_string()]
                };

                Ok(ProviderTestResult {
                    success: true,
                    status: "ok".to_string(),
                    message: "تم الاتصال بنجاح بمزود Google Gemini!".to_string(),
                    latency_ms,
                    available_models: models,
                })
            }
            Err(ureq::Error::Status(400..=403, _)) => Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: "مفتاح Google Gemini API غير صحيح أو مقيد الصلاحيات (Invalid API Key)".to_string(),
                latency_ms,
                available_models: vec![],
            }),
            Err(ureq::Error::Status(429, _)) => Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: "تم تجاوز حد الاستدعاءات في Google Gemini (429 Quota Exceeded)".to_string(),
                latency_ms,
                available_models: vec![],
            }),
            Err(e) => Ok(ProviderTestResult {
                success: false,
                status: "failed".to_string(),
                message: format!("فشل الاتصال بـ Google Gemini: {}", e),
                latency_ms,
                available_models: vec![],
            }),
        }
    }

    fn list_models(&self) -> AppResult<Vec<String>> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models?key={}",
            self.api_key.trim()
        );

        let resp = ureq::get(&url)
            .timeout(Duration::from_secs(10))
            .call();

        match resp {
            Ok(r) => {
                if let Ok(j) = r.into_json::<serde_json::Value>() {
                    let mut list: Vec<String> = j["models"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m["name"].as_str())
                                .filter(|name| name.contains("gemini"))
                                .map(|name| name.trim_start_matches("models/").to_string())
                                .collect()
                        })
                        .unwrap_or_default();
                    list.sort();
                    if !list.is_empty() {
                        return Ok(list);
                    }
                }
                Ok(vec!["gemini-1.5-flash".to_string(), "gemini-1.5-pro".to_string(), "gemini-2.0-flash".to_string()])
            }
            Err(_) => Ok(vec!["gemini-1.5-flash".to_string(), "gemini-1.5-pro".to_string(), "gemini-2.0-flash".to_string()]),
        }
    }

    fn generate_chat(&self, req: &ChatRequest) -> AppResult<ChatResponse> {
        let model = self.get_model();
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model,
            self.api_key.trim()
        );

        let mut gen_config = json!({
            "temperature": 0.7,
            "maxOutputTokens": req.max_tokens,
        });

        if req.json_mode {
            gen_config["responseMimeType"] = json!("application/json");
        }

        let body = json!({
            "systemInstruction": {
                "parts": [{ "text": req.system_prompt }]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{ "text": req.user_prompt }]
                }
            ],
            "generationConfig": gen_config
        });

        let resp = ureq::post(&url)
            .set("Content-Type", "application/json")
            .timeout(Duration::from_secs(30))
            .send_json(&body);

        match resp {
            Ok(r) => {
                let j: serde_json::Value = r.into_json()
                    .map_err(|e| AppError::Internal(format!("Failed to parse Google Gemini JSON response: {}", e)))?;

                let content = j["candidates"][0]["content"]["parts"][0]["text"]
                    .as_str()
                    .ok_or_else(|| AppError::Internal("Missing text in Gemini response candidate".to_string()))?
                    .to_string();

                Ok(ChatResponse { raw_text: content })
            }
            Err(ureq::Error::Status(code, r)) => {
                let err_body = r.into_string().unwrap_or_default();
                Err(AppError::Internal(format!("Google Gemini API error ({code}): {err_body}")))
            }
            Err(e) => Err(AppError::Internal(format!("Google Gemini network request failed: {e}"))),
        }
    }
}
