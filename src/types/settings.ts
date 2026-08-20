export interface SchedulerSettings {
  desired_retention: number;
  maximum_interval_days: number;
  enable_fuzzing: boolean;
  easy_bonus: number;
  hard_factor: number;
  max_reviews_per_day: number;
  max_new_cards_per_day: number;
}

export interface AppSettings {
  theme: 'system' | 'dark' | 'light';
  language: 'en' | 'ar';
  scheduler: SchedulerSettings;
  daily_study_target_minutes: number;
  sound_effects: boolean;
  animations_enabled: boolean;
  auto_reveal_answer_secs: number | null;
}

export interface BackupFileInfo {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

export interface ImportPreview {
  total_cards_found: number;
  sample_front: string | null;
  sample_back: string | null;
  sample_tags: string[];
}
