-- Starter Decks & Sample Cards

INSERT OR IGNORE INTO decks (id, parent_id, name, description, color, icon, priority, created_at, updated_at)
VALUES 
  ('deck-lang', NULL, 'Languages', 'Vocabulary and language acquisition', '#3b82f6', 'languages', 10, datetime('now'), datetime('now')),
  ('deck-en-a2', 'deck-lang', 'English A2 Vocabulary', 'Essential A2 level English vocabulary and expressions', '#60a5fa', 'book-open', 8, datetime('now'), datetime('now')),
  ('deck-prog', NULL, 'Computer Science', 'Programming paradigms, systems, and algorithms', '#10b981', 'code', 9, datetime('now'), datetime('now')),
  ('deck-rust', 'deck-prog', 'Rust & Systems Programming', 'Ownership, lifetimes, concurrency, and memory safety', '#059669', 'cpu', 9, datetime('now'), datetime('now')),
  ('deck-med', NULL, 'Science & Medicine', 'Human physiology and biological systems', '#f59e0b', 'activity', 5, datetime('now'), datetime('now'));

-- Tags
INSERT OR IGNORE INTO tags (id, name, color, created_at)
VALUES
  ('tag-1', 'vocabulary', '#3b82f6', datetime('now')),
  ('tag-2', 'a2', '#6366f1', datetime('now')),
  ('tag-3', 'verbs', '#8b5cf6', datetime('now')),
  ('tag-4', 'rust', '#10b981', datetime('now')),
  ('tag-5', 'memory-safety', '#14b8a6', datetime('now')),
  ('tag-6', 'concurrency', '#06b6d4', datetime('now')),
  ('tag-7', 'biology', '#f59e0b', datetime('now'));

-- English A2 Cards
INSERT OR IGNORE INTO cards (id, deck_id, card_type, front, back, notes, state, stability, difficulty, reps, lapses, review_count, last_review, next_review, interval_days, ease_factor, suspended, buried, created_at, updated_at)
VALUES
  ('card-en-1', 'deck-en-a2', 'basic', 'What does **achieve** mean?', 'To successfully bring about or reach a desired objective, result, or goal by effort, skill, or courage.', 'Example: *She worked hard to achieve her dream of becoming a pilot.*', 'review', 4.5, 3.2, 3, 0, 3, datetime('now', '-2 days'), datetime('now', '+2 days'), 4.0, 2.5, 0, 0, datetime('now', '-5 days'), datetime('now')),
  ('card-en-2', 'deck-en-a2', 'cloze', 'Water boils at {{c1::100}} degrees Celsius and freezes at {{c2::0}} degrees.', 'Standard physical state transition points of pure water at 1 atm.', NULL, 'new', 0.0, 0.0, 0, 0, 0, NULL, datetime('now'), 0.0, 2.5, 0, 0, datetime('now'), datetime('now')),
  ('card-en-3', 'deck-en-a2', 'basic', 'What is the past participle of **begin**?', '**Begun** (Begin - Began - Begun)', 'Common irregular verb pattern.', 'learning', 1.2, 5.1, 1, 1, 2, datetime('now', '-1 hours'), datetime('now', '-10 minutes'), 0.01, 2.5, 0, 0, datetime('now', '-1 days'), datetime('now')),
  ('card-en-4', 'deck-en-a2', 'basic', 'What does **reluctant** mean?', 'Unwilling and hesitant; disinclined.', 'Example: *He was reluctant to leave without saying goodbye.*', 'relearning', 0.8, 7.8, 2, 4, 6, datetime('now', '-3 hours'), datetime('now', '-30 minutes'), 0.01, 2.1, 0, 0, datetime('now', '-4 days'), datetime('now')),
  ('card-en-5', 'deck-en-a2', 'basic', 'Translate to English: **يُحسّن / يُطوّر**', '**Improve** / **Develop** / **Enhance**', NULL, 'new', 0.0, 0.0, 0, 0, 0, NULL, datetime('now'), 0.0, 2.5, 0, 0, datetime('now'), datetime('now'));

-- Rust Cards
INSERT OR IGNORE INTO cards (id, deck_id, card_type, front, back, notes, state, stability, difficulty, reps, lapses, review_count, last_review, next_review, interval_days, ease_factor, suspended, buried, created_at, updated_at)
VALUES
  ('card-rs-1', 'deck-rust', 'basic', 'What are the three core rules of **Ownership** in Rust?', '1. Each value in Rust has an **owner**.\n2. There can only be **one owner at a time**.\n3. When the owner goes **out of scope**, the value is dropped.', 'Guarantees memory safety at compile time without a garbage collector.', 'review', 8.2, 4.0, 4, 0, 4, datetime('now', '-3 days'), datetime('now', '+5 days'), 8.0, 2.5, 0, 0, datetime('now', '-8 days'), datetime('now')),
  ('card-rs-2', 'deck-rust', 'cloze', 'Rust guarantees data-race freedom because you can have either **multiple {{c1::immutable}} references** (`&T`) OR **one {{c2::mutable}} reference** (`&mut T`), but never both simultaneously.', 'The Aliasing XOR Mutability theorem in Rust type system.', NULL, 'review', 12.0, 4.5, 5, 0, 5, datetime('now', '-6 days'), datetime('now', '+6 days'), 12.0, 2.5, 0, 0, datetime('now', '-12 days'), datetime('now')),
  ('card-rs-3', 'deck-rust', 'basic', 'What is the purpose of `std::sync::Arc<T>` in Rust?', '`Arc` stands for **Atomically Reference Counted**. It allows safe, thread-shared immutable ownership of data across multiple threads.', 'Combine with `Mutex<T>` or `RwLock<T>` for shared mutable state across threads.', 'new', 0.0, 0.0, 0, 0, 0, NULL, datetime('now'), 0.0, 2.5, 0, 0, datetime('now'), datetime('now')),
  ('card-rs-4', 'deck-rust', 'basic', 'What trait must a type implement to be safely sent to another thread in Rust?', 'The `Send` marker trait. (`Sync` indicates a reference `&T` can be safely shared).', 'Automatically implemented by the compiler for types composed entirely of `Send` fields.', 'new', 0.0, 0.0, 0, 0, 0, NULL, datetime('now'), 0.0, 2.5, 0, 0, datetime('now'), datetime('now'));

-- Link Card Tags
INSERT OR IGNORE INTO card_tags (card_id, tag_id)
VALUES
  ('card-en-1', 'tag-1'),
  ('card-en-1', 'tag-2'),
  ('card-en-2', 'tag-1'),
  ('card-en-3', 'tag-1'),
  ('card-en-3', 'tag-3'),
  ('card-en-4', 'tag-1'),
  ('card-en-5', 'tag-1'),
  ('card-rs-1', 'tag-4'),
  ('card-rs-1', 'tag-5'),
  ('card-rs-2', 'tag-4'),
  ('card-rs-2', 'tag-5'),
  ('card-rs-3', 'tag-4'),
  ('card-rs-3', 'tag-6'),
  ('card-rs-4', 'tag-4'),
  ('card-rs-4', 'tag-6');

-- Past Reviews (to provide instant heatmap & analytics history)
INSERT OR IGNORE INTO reviews (id, card_id, session_id, rating, review_state, scheduled_days, elapsed_days, last_stability, new_stability, last_difficulty, new_difficulty, response_time_ms, reviewed_at)
VALUES
  ('rev-1', 'card-en-1', NULL, 3, 'new', 0.0, 0.0, 0.0, 3.1, 0.0, 4.0, 3200, datetime('now', '-5 days')),
  ('rev-2', 'card-en-1', NULL, 3, 'review', 3.0, 3.0, 3.1, 4.5, 4.0, 3.8, 2400, datetime('now', '-2 days')),
  ('rev-3', 'card-rs-1', NULL, 4, 'new', 0.0, 0.0, 0.0, 6.0, 0.0, 3.5, 1800, datetime('now', '-8 days')),
  ('rev-4', 'card-rs-1', NULL, 3, 'review', 6.0, 5.0, 6.0, 8.2, 3.5, 3.4, 2100, datetime('now', '-3 days')),
  ('rev-5', 'card-rs-2', NULL, 3, 'new', 0.0, 0.0, 0.0, 3.5, 0.0, 4.2, 4500, datetime('now', '-12 days')),
  ('rev-6', 'card-rs-2', NULL, 4, 'review', 4.0, 6.0, 3.5, 12.0, 4.2, 3.8, 3100, datetime('now', '-6 days')),
  ('rev-7', 'card-en-4', NULL, 1, 'review', 2.0, 2.0, 2.0, 0.8, 6.0, 7.8, 6500, datetime('now', '-3 hours'));

-- Initial Settings
INSERT OR IGNORE INTO settings (key, value, updated_at)
VALUES
  ('app_settings', '{"theme":"system","language":"en","scheduler":{"desired_retention":0.90,"maximum_interval_days":36500,"enable_fuzzing":true,"easy_bonus":1.3,"hard_factor":1.2,"max_reviews_per_day":200,"max_new_cards_per_day":20},"daily_study_target_minutes":30,"sound_effects":true,"animations_enabled":true,"auto_reveal_answer_secs":null}', datetime('now')),
  ('pomodoro_config', '{"focus_duration_secs":1500,"short_break_duration_secs":300,"long_break_duration_secs":900,"sessions_before_long_break":4,"auto_start_breaks":false,"auto_start_focus":false,"sound_enabled":true,"notifications_enabled":true}', datetime('now'));
