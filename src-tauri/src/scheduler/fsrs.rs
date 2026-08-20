use chrono::{DateTime, Duration, Utc};

use crate::domain::card::{Card, CardState, NextReviewPreviews, Rating};
use super::models::{FSRSParameters, FSRSReviewCalculation};

pub struct FSRSScheduler {
    pub params: FSRSParameters,
}

impl Default for FSRSScheduler {
    fn default() -> Self {
        Self {
            params: FSRSParameters::default(),
        }
    }
}

impl FSRSScheduler {
    pub fn new(params: FSRSParameters) -> Self {
        Self { params }
    }

    /// Calculate retrievability R(t, S) = (1 + t / (9 * S))^-1
    pub fn calculate_retrievability(&self, stability: f64, elapsed_days: f64) -> f64 {
        if stability <= 0.0 {
            return 0.0;
        }
        if elapsed_days <= 0.0 {
            return 1.0;
        }
        (1.0 + elapsed_days / (9.0 * stability)).recip()
    }

    /// Calculate initial stability S0(G) = w[G-1]
    pub fn init_stability(&self, rating: Rating) -> f64 {
        let idx = match rating {
            Rating::Again => 0,
            Rating::Hard => 1,
            Rating::Good => 2,
            Rating::Easy => 3,
        };
        self.params.w[idx].max(0.1)
    }

    /// Calculate initial difficulty D0(G) = w4 - exp(w5 * (G - 1)) + 1
    pub fn init_difficulty(&self, rating: Rating) -> f64 {
        let g = rating.as_u8() as f64;
        let d = self.params.w[4] - (self.params.w[5] * (g - 1.0)).exp() + 1.0;
        d.clamp(1.0, 10.0)
    }

    /// Calculate next difficulty with mean reversion
    pub fn next_difficulty(&self, current_difficulty: f64, rating: Rating) -> f64 {
        let g = rating.as_u8() as f64;
        let delta_d = -self.params.w[6] * (g - 3.0);
        let d_after_delta = current_difficulty + delta_d;
        let baseline = self.init_difficulty(Rating::Good);
        let mean_reverted = self.params.w[7] * baseline + (1.0 - self.params.w[7]) * d_after_delta;
        mean_reverted.clamp(1.0, 10.0)
    }

    /// Calculate stability after recall (Hard, Good, Easy)
    pub fn stability_after_recall(
        &self,
        current_stability: f64,
        current_difficulty: f64,
        retrievability: f64,
        rating: Rating,
    ) -> f64 {
        let hard_penalty = if rating == Rating::Hard {
            self.params.w[15]
        } else {
            1.0
        };
        let easy_bonus = if rating == Rating::Easy {
            self.params.w[16]
        } else {
            1.0
        };

        let diff_factor = 11.0 - current_difficulty;
        let s_power = current_stability.powf(-self.params.w[9]);
        let r_factor = (self.params.w[10] * (1.0 - retrievability)).exp() - 1.0;

        let multiplier = 1.0
            + self.params.w[8].exp()
                * diff_factor
                * s_power
                * r_factor
                * hard_penalty
                * easy_bonus;

        (current_stability * multiplier).max(0.1)
    }

    /// Calculate stability after lapse (Again)
    pub fn stability_after_lapse(
        &self,
        current_stability: f64,
        current_difficulty: f64,
        retrievability: f64,
    ) -> f64 {
        let d_power = current_difficulty.powf(-self.params.w[12]);
        let s_power = (current_stability + 1.0).powf(self.params.w[13]) - 1.0;
        let r_factor = (self.params.w[14] * (1.0 - retrievability)).exp();

        let s = self.params.w[11] * d_power * s_power * r_factor;
        s.min(current_stability).max(0.1)
    }

    /// Calculate interval in days for a given stability and target retention
    pub fn calculate_interval(&self, stability: f64) -> f64 {
        if stability <= 0.0 {
            return 0.0;
        }
        let interval = 9.0 * stability * (1.0 / self.params.request_retention - 1.0);
        interval.clamp(1.0, self.params.maximum_interval)
    }

    /// Calculate review outcome for a specific rating
    pub fn calculate_review_outcome(
        &self,
        card: &Card,
        rating: Rating,
        now: DateTime<Utc>,
    ) -> FSRSReviewCalculation {
        let is_new = card.state == CardState::New || card.review_count == 0;

        if is_new {
            let next_stab = self.init_stability(rating);
            let next_diff = self.init_difficulty(rating);
            let next_interval = match rating {
                Rating::Again => 0.007, // ~10 minutes
                Rating::Hard => 1.0,
                Rating::Good => self.calculate_interval(next_stab).max(1.0),
                Rating::Easy => (self.calculate_interval(next_stab) * 1.5).max(3.0),
            };

            let desc = format_interval_description(next_interval);
            return FSRSReviewCalculation {
                next_stability: next_stab,
                next_difficulty: next_diff,
                next_interval_days: next_interval,
                interval_description: desc,
            };
        }

        let elapsed_days = if let Some(last_rev) = card.last_review {
            let duration = now.signed_duration_since(last_rev);
            (duration.num_seconds() as f64 / 86400.0).max(0.0)
        } else {
            0.0
        };

        let retrievability = self.calculate_retrievability(card.stability, elapsed_days);
        let next_diff = self.next_difficulty(card.difficulty, rating);

        let (next_stab, next_interval) = match rating {
            Rating::Again => {
                let s = self.stability_after_lapse(card.stability, card.difficulty, retrievability);
                let ivl = 0.007; // ~10 min
                (s, ivl)
            }
            Rating::Hard => {
                let s = self.stability_after_recall(
                    card.stability,
                    card.difficulty,
                    retrievability,
                    Rating::Hard,
                );
                let base_ivl = self.calculate_interval(s);
                let ivl = (base_ivl * 0.8).max(1.0);
                (s, ivl)
            }
            Rating::Good => {
                let s = self.stability_after_recall(
                    card.stability,
                    card.difficulty,
                    retrievability,
                    Rating::Good,
                );
                let ivl = self.calculate_interval(s).max(1.0);
                (s, ivl)
            }
            Rating::Easy => {
                let s = self.stability_after_recall(
                    card.stability,
                    card.difficulty,
                    retrievability,
                    Rating::Easy,
                );
                let ivl = (self.calculate_interval(s) * 1.3).max(2.0);
                (s, ivl)
            }
        };

        let desc = format_interval_description(next_interval);

        FSRSReviewCalculation {
            next_stability: next_stab,
            next_difficulty: next_diff,
            next_interval_days: next_interval,
            interval_description: desc,
        }
    }

    /// Calculate review previews for all 4 buttons dynamically
    pub fn get_next_review_previews(&self, card: &Card, now: DateTime<Utc>) -> NextReviewPreviews {
        let again_res = self.calculate_review_outcome(card, Rating::Again, now);
        let hard_res = self.calculate_review_outcome(card, Rating::Hard, now);
        let good_res = self.calculate_review_outcome(card, Rating::Good, now);
        let easy_res = self.calculate_review_outcome(card, Rating::Easy, now);

        NextReviewPreviews {
            again_interval_desc: again_res.interval_description,
            hard_interval_desc: hard_res.interval_description,
            good_interval_desc: good_res.interval_description,
            easy_interval_desc: easy_res.interval_description,
        }
    }

    /// Update card after rating
    pub fn apply_review(&self, card: &mut Card, rating: Rating, now: DateTime<Utc>) -> FSRSReviewCalculation {
        let outcome = self.calculate_review_outcome(card, rating, now);

        card.stability = outcome.next_stability;
        card.difficulty = outcome.next_difficulty;
        card.interval_days = outcome.next_interval_days;
        card.review_count += 1;
        card.last_review = Some(now);

        let next_rev_duration = Duration::seconds((outcome.next_interval_days * 86400.0) as i64);
        card.next_review = Some(now + next_rev_duration);

        match rating {
            Rating::Again => {
                card.lapses += 1;
                card.reps = 0;
                card.state = CardState::Relearning;
            }
            Rating::Hard => {
                card.reps += 1;
                if card.state == CardState::New {
                    card.state = CardState::Learning;
                } else if card.state == CardState::Relearning {
                    card.state = CardState::Learning;
                } else {
                    card.state = CardState::Review;
                }
            }
            Rating::Good | Rating::Easy => {
                card.reps += 1;
                card.state = CardState::Review;
            }
        }

        outcome
    }
}

pub fn format_interval_description(days: f64) -> String {
    if days < (1.0 / 24.0) {
        // Less than an hour -> in minutes
        let mins = (days * 1440.0).round() as i64;
        format!("< {}m", mins.max(1))
    } else if days < 1.0 {
        let hours = (days * 24.0).round() as i64;
        format!("{}h", hours.max(1))
    } else if days < 30.0 {
        let rounded = days.round() as i64;
        if rounded == 1 {
            "1 day".to_string()
        } else {
            format!("{} days", rounded)
        }
    } else if days < 365.0 {
        let months = (days / 30.4375).round() as i64;
        if months <= 1 {
            "1 mo".to_string()
        } else {
            format!("{} mo", months)
        }
    } else {
        let years = (days / 365.25 * 10.0).round() / 10.0;
        format!("{:.1} y", years)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_card() -> Card {
        let now = Utc::now();
        Card {
            id: "test-card-1".to_string(),
            deck_id: "deck-1".to_string(),
            card_type: crate::domain::card::CardType::Basic,
            front: "What is FSRS?".to_string(),
            back: "Free Spaced Repetition Scheduler".to_string(),
            notes: None,
            state: CardState::New,
            stability: 0.0,
            difficulty: 0.0,
            reps: 0,
            lapses: 0,
            review_count: 0,
            last_review: None,
            next_review: None,
            interval_days: 0.0,
            ease_factor: 2.5,
            suspended: false,
            buried: false,
            tags: vec!["spaced-repetition".to_string()],
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn test_initial_review_good() {
        let scheduler = FSRSScheduler::default();
        let mut card = create_test_card();
        let now = Utc::now();

        let outcome = scheduler.apply_review(&mut card, Rating::Good, now);
        assert_eq!(card.state, CardState::Review);
        assert_eq!(card.review_count, 1);
        assert_eq!(card.reps, 1);
        assert!(card.stability > 0.0);
        assert!(card.difficulty >= 1.0 && card.difficulty <= 10.0);
        assert!(outcome.next_interval_days >= 1.0);
    }

    #[test]
    fn test_lapse_resets_reps_and_increments_lapses() {
        let scheduler = FSRSScheduler::default();
        let mut card = create_test_card();
        let now = Utc::now();

        // First review: Good
        scheduler.apply_review(&mut card, Rating::Good, now);

        // Later review: Lapse (Again)
        let later = now + Duration::days(5);
        scheduler.apply_review(&mut card, Rating::Again, later);

        assert_eq!(card.state, CardState::Relearning);
        assert_eq!(card.lapses, 1);
        assert_eq!(card.reps, 0);
        assert_eq!(card.review_count, 2);
    }

    #[test]
    fn test_retrievability_decay() {
        let scheduler = FSRSScheduler::default();
        let r0 = scheduler.calculate_retrievability(5.0, 0.0);
        let r5 = scheduler.calculate_retrievability(5.0, 5.0);
        let r20 = scheduler.calculate_retrievability(5.0, 20.0);

        assert_eq!(r0, 1.0);
        assert!(r5 < 1.0 && r5 > 0.8);
        assert!(r20 < r5);
    }
}
