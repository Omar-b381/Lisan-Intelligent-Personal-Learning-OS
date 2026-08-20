export type PomodoroMode = 'focus' | 'short_break' | 'long_break';

export interface PomodoroConfig {
  focus_duration_secs: number;
  short_break_duration_secs: number;
  long_break_duration_secs: number;
  sessions_before_long_break: number;
  auto_start_breaks: boolean;
  auto_start_focus: boolean;
  sound_enabled: boolean;
  notifications_enabled: boolean;
}

export interface PomodoroSession {
  id: string;
  mode: PomodoroMode;
  target_duration_secs: number;
  actual_duration_secs: number;
  completed: boolean;
  started_at: string;
  ended_at: string | null;
}

export interface PomodoroSessionSummary {
  session_id: string;
  focus_minutes: number;
  cards_reviewed: number;
  cards_correct: number;
  cards_incorrect: number;
  success_rate: number;
  xp_earned: number;
}
