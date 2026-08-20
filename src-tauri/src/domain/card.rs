use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardState {
    New,
    Learning,
    Review,
    Relearning,
    Suspended,
    Buried,
}

impl CardState {
    pub fn as_str(&self) -> &'static str {
        match self {
            CardState::New => "new",
            CardState::Learning => "learning",
            CardState::Review => "review",
            CardState::Relearning => "relearning",
            CardState::Suspended => "suspended",
            CardState::Buried => "buried",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "learning" => CardState::Learning,
            "review" => CardState::Review,
            "relearning" => CardState::Relearning,
            "suspended" => CardState::Suspended,
            "buried" => CardState::Buried,
            _ => CardState::New,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardType {
    Basic,
    Cloze,
    Image,
    Audio,
}

impl CardType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CardType::Basic => "basic",
            CardType::Cloze => "cloze",
            CardType::Image => "image",
            CardType::Audio => "audio",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "cloze" => CardType::Cloze,
            "image" => CardType::Image,
            "audio" => CardType::Audio,
            _ => CardType::Basic,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Rating {
    Again = 1,
    Hard = 2,
    Good = 3,
    Easy = 4,
}

impl Rating {
    pub fn as_u8(&self) -> u8 {
        *self as u8
    }

    pub fn from_u8(val: u8) -> Self {
        match val {
            1 => Rating::Again,
            2 => Rating::Hard,
            4 => Rating::Easy,
            _ => Rating::Good,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub id: String,
    pub deck_id: String,
    pub card_type: CardType,
    pub front: String,
    pub back: String,
    pub notes: Option<String>,
    pub state: CardState,
    pub stability: f64,
    pub difficulty: f64,
    pub reps: u32,
    pub lapses: u32,
    pub review_count: u32,
    pub last_review: Option<DateTime<Utc>>,
    pub next_review: Option<DateTime<Utc>>,
    pub interval_days: f64,
    pub ease_factor: f64,
    pub suspended: bool,
    pub buried: bool,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardWithDeckInfo {
    #[serde(flatten)]
    pub card: Card,
    pub deck_name: String,
    pub deck_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCardDto {
    pub deck_id: String,
    pub card_type: CardType,
    pub front: String,
    pub back: String,
    pub notes: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCardDto {
    pub id: String,
    pub deck_id: Option<String>,
    pub card_type: Option<CardType>,
    pub front: Option<String>,
    pub back: Option<String>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
    pub suspended: Option<bool>,
    pub buried: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NextReviewPreviews {
    pub again_interval_desc: String,
    pub hard_interval_desc: String,
    pub good_interval_desc: String,
    pub easy_interval_desc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardStudyItem {
    pub card: Card,
    pub deck_name: String,
    pub previews: NextReviewPreviews,
    pub priority_score: f64,
    pub current_retrievability: f64,
}
