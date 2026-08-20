use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deck {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub icon: String,
    pub priority: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeckStats {
    pub total_cards: u32,
    pub new_cards: u32,
    pub learning_cards: u32,
    pub due_cards: u32,
    pub suspended_cards: u32,
    pub today_reviews: u32,
    pub retention_rate: f64,
    pub study_time_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeckWithStats {
    #[serde(flatten)]
    pub deck: Deck,
    pub stats: DeckStats,
    pub children: Vec<DeckWithStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeckDto {
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub priority: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDeckDto {
    pub id: String,
    pub parent_id: Option<Option<String>>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub priority: Option<i32>,
}
