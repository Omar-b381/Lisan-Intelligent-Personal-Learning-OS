export interface StudySession {
  id: string;
  deck_id: string | null;
  pomodoro_id: string | null;
  started_at: string;
  ended_at: string | null;
  cards_reviewed: number;
  cards_correct: number;
  cards_incorrect: number;
  xp_earned: number;
}

export interface DailyStudyPlan {
  due_reviews_count: number;
  new_cards_count: number;
  weak_cards_count: number;
  total_due_today: number;
  estimated_study_time_minutes: number;
  recommended_pomodoros: number;
  current_streak_days: number;
  today_cards_reviewed: number;
  today_study_time_minutes: number;
  target_daily_reviews: number;
}

export interface HeatmapDay {
  date: string;
  count: number;
  minutes: number;
  level: number; // 0 to 4
}

export interface OverallStats {
  total_cards: number;
  cards_learned: number;
  cards_due: number;
  cards_reviewed_today: number;
  total_reviews_all_time: number;
  total_study_time_minutes: number;
  average_response_time_ms: number;
  overall_retention_rate: number;
  current_streak_days: number;
  longest_streak_days: number;
  pomodoro_sessions_completed: number;
  total_xp: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  secondary_value?: number | null;
}

export interface WeakCardInfo {
  card_id: string;
  deck_name: string;
  front: string;
  lapses: number;
  failure_rate: number;
  difficulty: number;
  retention_estimate: number;
}

export interface TagStats {
  id: string;
  name: string;
  color: string;
  card_count: number;
  retention_rate: number;
}
