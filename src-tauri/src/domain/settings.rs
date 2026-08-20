use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerSettings {
    pub desired_retention: f64,
    pub maximum_interval_days: u32,
    pub enable_fuzzing: bool,
    pub easy_bonus: f64,
    pub hard_factor: f64,
    pub max_reviews_per_day: u32,
    pub max_new_cards_per_day: u32,
}

impl Default for SchedulerSettings {
    fn default() -> Self {
        Self {
            desired_retention: 0.90,
            maximum_interval_days: 36500, // 100 years
            enable_fuzzing: true,
            easy_bonus: 1.3,
            hard_factor: 1.2,
            max_reviews_per_day: 200,
            max_new_cards_per_day: 20,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String, // "system" | "dark" | "light"
    pub language: String, // "en" | "ar"
    pub scheduler: SchedulerSettings,
    pub daily_study_target_minutes: u32,
    pub sound_effects: bool,
    pub animations_enabled: bool,
    pub auto_reveal_answer_secs: Option<u32>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            language: "en".to_string(),
            scheduler: SchedulerSettings::default(),
            daily_study_target_minutes: 30,
            sound_effects: true,
            animations_enabled: true,
            auto_reveal_answer_secs: None,
        }
    }
}
