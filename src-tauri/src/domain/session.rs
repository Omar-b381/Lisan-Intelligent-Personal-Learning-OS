use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudySession {
    pub id: String,
    pub deck_id: Option<String>,
    pub pomodoro_id: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub cards_reviewed: u32,
    pub cards_correct: u32,
    pub cards_incorrect: u32,
    pub xp_earned: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyStudyPlan {
    pub due_reviews_count: u32,
    pub new_cards_count: u32,
    pub weak_cards_count: u32,
    pub total_due_today: u32,
    pub estimated_study_time_minutes: u32,
    pub recommended_pomodoros: u32,
    pub current_streak_days: u32,
    pub today_cards_reviewed: u32,
    pub today_study_time_minutes: u32,
    pub target_daily_reviews: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapDay {
    pub date: String, // YYYY-MM-DD
    pub count: u32,   // cards reviewed or minutes studied
    pub minutes: u32,
    pub level: u8,    // 0 to 4
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverallStats {
    pub total_cards: u32,
    pub cards_learned: u32,
    pub cards_due: u32,
    pub cards_reviewed_today: u32,
    pub total_reviews_all_time: u32,
    pub total_study_time_minutes: u32,
    pub average_response_time_ms: u32,
    pub overall_retention_rate: f64,
    pub current_streak_days: u32,
    pub longest_streak_days: u32,
    pub pomodoro_sessions_completed: u32,
    pub total_xp: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartDataPoint {
    pub date: String,
    pub value: f64,
    pub secondary_value: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeakCardInfo {
    pub card_id: String,
    pub deck_name: String,
    pub front: String,
    pub lapses: u32,
    pub failure_rate: f64,
    pub difficulty: f64,
    pub retention_estimate: f64,
}
