use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::card::{CardState, Rating};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewLog {
    pub id: String,
    pub card_id: String,
    pub session_id: Option<String>,
    pub rating: Rating,
    pub review_state: CardState,
    pub scheduled_days: f64,
    pub elapsed_days: f64,
    pub last_stability: f64,
    pub new_stability: f64,
    pub last_difficulty: f64,
    pub new_difficulty: f64,
    pub response_time_ms: u32,
    pub reviewed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitReviewDto {
    pub card_id: String,
    pub rating: Rating,
    pub response_time_ms: u32,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewResult {
    pub review_log: ReviewLog,
    pub updated_card_state: CardState,
    pub next_review: DateTime<Utc>,
    pub interval_days: f64,
    pub xp_earned: u32,
}
