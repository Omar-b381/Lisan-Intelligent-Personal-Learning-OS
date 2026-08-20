import { CardState, Rating } from './card';

export interface ReviewLog {
  id: string;
  card_id: string;
  session_id: string | null;
  rating: Rating;
  review_state: CardState;
  scheduled_days: number;
  elapsed_days: number;
  last_stability: number;
  new_stability: number;
  last_difficulty: number;
  new_difficulty: number;
  response_time_ms: number;
  reviewed_at: string;
}

export interface SubmitReviewDto {
  card_id: string;
  rating: Rating;
  response_time_ms: number;
  session_id?: string | null;
}

export interface ReviewResult {
  review_log: ReviewLog;
  updated_card_state: CardState;
  next_review: string;
  interval_days: number;
  xp_earned: number;
}
