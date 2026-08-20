use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PomodoroMode {
    Focus,
    ShortBreak,
    LongBreak,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroConfig {
    pub focus_duration_secs: u32,
    pub short_break_duration_secs: u32,
    pub long_break_duration_secs: u32,
    pub sessions_before_long_break: u32,
    pub auto_start_breaks: bool,
    pub auto_start_focus: bool,
    pub sound_enabled: bool,
    pub notifications_enabled: bool,
}

impl Default for PomodoroConfig {
    fn default() -> Self {
        Self {
            focus_duration_secs: 25 * 60,
            short_break_duration_secs: 5 * 60,
            long_break_duration_secs: 15 * 60,
            sessions_before_long_break: 4,
            auto_start_breaks: false,
            auto_start_focus: false,
            sound_enabled: true,
            notifications_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroSession {
    pub id: String,
    pub mode: PomodoroMode,
    pub target_duration_secs: u32,
    pub actual_duration_secs: u32,
    pub completed: bool,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroSessionSummary {
    pub session_id: String,
    pub focus_minutes: u32,
    pub cards_reviewed: u32,
    pub cards_correct: u32,
    pub cards_incorrect: u32,
    pub success_rate: f64,
    pub xp_earned: u32,
}
