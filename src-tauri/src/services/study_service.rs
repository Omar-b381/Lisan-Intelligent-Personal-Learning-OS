use chrono::Utc;
use uuid::Uuid;

use crate::database::connection::Database;
use crate::database::repositories::{CardRepository, DeckRepository, ReviewRepository, SessionRepository};
use crate::domain::card::{CardStudyItem, Rating};
use crate::domain::review::{ReviewLog, ReviewResult, SubmitReviewDto};
use crate::domain::session::{DailyStudyPlan, StudySession};
use crate::errors::AppResult;
use crate::scheduler::{CardPrioritizer, FSRSScheduler};

pub struct StudyService {
    db: Database,
    scheduler: FSRSScheduler,
}

impl StudyService {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            scheduler: FSRSScheduler::default(),
        }
    }

    /// Prepare intelligent study queue for a deck (or all decks) sorted by priority
    pub fn get_study_queue(&self, deck_id: Option<String>, limit: Option<u32>) -> AppResult<Vec<CardStudyItem>> {
        let conn = self.db.get_connection();
        let max_cards = limit.unwrap_or(50);
        let now = Utc::now();

        let raw_cards = if let Some(ref did) = deck_id {
            CardRepository::get_due_cards_for_deck(&conn, did, max_cards)?
        } else {
            CardRepository::get_all_due_cards(&conn, max_cards)?
        };

        let decks = DeckRepository::get_all(&conn)?;
        let deck_map: std::collections::HashMap<String, &crate::domain::deck::Deck> =
            decks.iter().map(|d| (d.id.clone(), d)).collect();

        let prioritizer = CardPrioritizer::new(&self.scheduler);

        let mut items: Vec<CardStudyItem> = raw_cards
            .into_iter()
            .map(|card| {
                let deck_name = deck_map
                    .get(&card.deck_id)
                    .map(|d| d.name.clone())
                    .unwrap_or_else(|| "General".to_string());
                let deck_priority = deck_map.get(&card.deck_id).map(|d| d.priority).unwrap_or(0);

                let previews = self.scheduler.get_next_review_previews(&card, now);
                let priority_score = prioritizer.calculate_priority_score(&card, now, deck_priority);

                let elapsed_days = if let Some(last_rev) = card.last_review {
                    (now.signed_duration_since(last_rev).num_seconds() as f64 / 86400.0).max(0.0)
                } else {
                    0.0
                };
                let current_retrievability = self.scheduler.calculate_retrievability(card.stability, elapsed_days);

                CardStudyItem {
                    card,
                    deck_name,
                    previews,
                    priority_score,
                    current_retrievability: (current_retrievability * 100.0).round() / 100.0,
                }
            })
            .collect();

        // Sort descending by priority score
        items.sort_by(|a, b| b.priority_score.partial_cmp(&a.priority_score).unwrap_or(std::cmp::Ordering::Equal));

        Ok(items)
    }

    /// Process a card review transactionally: update FSRS parameters, record review log, update session XP
    pub fn submit_review(&self, dto: SubmitReviewDto) -> AppResult<ReviewResult> {
        let conn = self.db.get_connection();
        let now = Utc::now();

        let mut card = CardRepository::get_by_id(&conn, &dto.card_id)?;
        let prev_stability = card.stability;
        let prev_difficulty = card.difficulty;
        let prev_state = card.state;

        let elapsed_days = if let Some(last_rev) = card.last_review {
            (now.signed_duration_since(last_rev).num_seconds() as f64 / 86400.0).max(0.0)
        } else {
            0.0
        };

        // Apply FSRS review mathematics
        let outcome = self.scheduler.apply_review(&mut card, dto.rating, now);

        // Update card in DB
        CardRepository::update_card_fsrs(&conn, &card)?;

        // XP calculation
        let is_correct = dto.rating != Rating::Again;
        let xp_earned = match dto.rating {
            Rating::Again => 2,
            Rating::Hard => 6,
            Rating::Good => 10,
            Rating::Easy => 15,
        };

        // Insert Review Log
        let review_log = ReviewLog {
            id: format!("rev-{}", Uuid::new_v4()),
            card_id: card.id.clone(),
            session_id: dto.session_id.clone(),
            rating: dto.rating,
            review_state: prev_state,
            scheduled_days: outcome.next_interval_days,
            elapsed_days,
            last_stability: prev_stability,
            new_stability: outcome.next_stability,
            last_difficulty: prev_difficulty,
            new_difficulty: outcome.next_difficulty,
            response_time_ms: dto.response_time_ms,
            reviewed_at: now,
        };

        ReviewRepository::insert(&conn, &review_log)?;

        // If session_id is active, increment session stats
        if let Some(ref sid) = dto.session_id {
            let _ = SessionRepository::record_session_card(&conn, sid, is_correct, xp_earned);
        }

        Ok(ReviewResult {
            review_log,
            updated_card_state: card.state,
            next_review: card.next_review.unwrap_or(now),
            interval_days: outcome.next_interval_days,
            xp_earned,
        })
    }

    pub fn start_study_session(&self, deck_id: Option<String>, pomodoro_id: Option<String>) -> AppResult<StudySession> {
        let conn = self.db.get_connection();
        SessionRepository::start_session(&conn, deck_id, pomodoro_id)
    }

    pub fn end_study_session(&self, session_id: &str) -> AppResult<StudySession> {
        let conn = self.db.get_connection();
        SessionRepository::end_session(&conn, session_id)
    }

    pub fn get_daily_study_plan(&self) -> AppResult<DailyStudyPlan> {
        let conn = self.db.get_connection();
        SessionRepository::get_daily_plan(&conn)
    }
}
