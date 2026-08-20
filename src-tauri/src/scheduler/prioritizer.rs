use chrono::{DateTime, Utc};
use crate::domain::card::{Card, CardState};
use super::fsrs::FSRSScheduler;

pub struct CardPrioritizer<'a> {
    pub scheduler: &'a FSRSScheduler,
}

impl<'a> CardPrioritizer<'a> {
    pub fn new(scheduler: &'a FSRSScheduler) -> Self {
        Self { scheduler }
    }

    /// Calculate dynamic priority score for queue ordering (higher = more urgent)
    pub fn calculate_priority_score(&self, card: &Card, now: DateTime<Utc>, deck_priority: i32) -> f64 {
        if card.suspended || card.buried {
            return -1000.0;
        }

        // 1. Learning / Relearning cards have highest immediate priority
        let state_weight = match card.state {
            CardState::Relearning => 100.0,
            CardState::Learning => 80.0,
            CardState::Review => 50.0,
            CardState::New => 20.0,
            _ => 0.0,
        };

        // 2. Overdue calculation
        let overdue_score = if let Some(next_rev) = card.next_review {
            if now > next_rev {
                let overdue_seconds = now.signed_duration_since(next_rev).num_seconds() as f64;
                let overdue_days = overdue_seconds / 86400.0;
                let interval = card.interval_days.max(1.0);
                // Overdue ratio (how much overdue relative to its interval)
                (overdue_days / interval) * 25.0
            } else {
                0.0
            }
        } else {
            0.0
        };

        // 3. Forgetting risk (1.0 - Retrievability)
        let elapsed_days = if let Some(last_rev) = card.last_review {
            (now.signed_duration_since(last_rev).num_seconds() as f64 / 86400.0).max(0.0)
        } else {
            0.0
        };
        let retrievability = self.scheduler.calculate_retrievability(card.stability, elapsed_days);
        let forgetting_risk_score = (1.0 - retrievability) * 30.0;

        // 4. Difficulty weight
        let difficulty_score = (card.difficulty / 10.0) * 10.0;

        // 5. Lapse penalty (frequently failed cards get higher attention)
        let lapse_score = (card.lapses as f64 * 3.0).min(30.0);

        // 6. Deck priority adjustment
        let deck_score = deck_priority as f64 * 2.0;

        state_weight + overdue_score + forgetting_risk_score + difficulty_score + lapse_score + deck_score
    }
}
