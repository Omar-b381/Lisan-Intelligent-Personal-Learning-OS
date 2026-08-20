-- Enable foreign keys & WAL mode
PRAGMA foreign_keys = ON;

-- Decks table
CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES decks(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    icon TEXT NOT NULL DEFAULT 'folder',
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decks_parent_id ON decks(parent_id);
CREATE INDEX IF NOT EXISTS idx_decks_name ON decks(name);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    card_type TEXT NOT NULL DEFAULT 'basic', -- 'basic', 'cloze', 'image', 'audio'
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    notes TEXT,
    state TEXT NOT NULL DEFAULT 'new', -- 'new', 'learning', 'review', 'relearning', 'suspended', 'buried'
    stability REAL NOT NULL DEFAULT 0.0,
    difficulty REAL NOT NULL DEFAULT 0.0,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    last_review TEXT,
    next_review TEXT,
    interval_days REAL NOT NULL DEFAULT 0.0,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    suspended INTEGER NOT NULL DEFAULT 0,
    buried INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(state);
CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards(next_review);
CREATE INDEX IF NOT EXISTS idx_cards_due_lookup ON cards(deck_id, state, suspended, buried, next_review);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#64748b',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Card Tags junction
CREATE TABLE IF NOT EXISTS card_tags (
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_card_tags_tag_id ON card_tags(tag_id);

-- Media Vault table
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Card Media junction
CREATE TABLE IF NOT EXISTS card_media (
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, media_id)
);

-- Pomodoro Sessions table
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'focus', -- 'focus', 'short_break', 'long_break'
    target_duration_secs INTEGER NOT NULL,
    actual_duration_secs INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    ended_at TEXT
);

-- Study Sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    deck_id TEXT REFERENCES decks(id) ON DELETE SET NULL,
    pomodoro_id TEXT REFERENCES pomodoro_sessions(id) ON DELETE SET NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    cards_reviewed INTEGER NOT NULL DEFAULT 0,
    cards_correct INTEGER NOT NULL DEFAULT 0,
    cards_incorrect INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0
);

-- Reviews log table (immutable audit of every recall attempt)
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES study_sessions(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL, -- 1=Again, 2=Hard, 3=Good, 4=Easy
    review_state TEXT NOT NULL,
    scheduled_days REAL NOT NULL,
    elapsed_days REAL NOT NULL,
    last_stability REAL NOT NULL,
    new_stability REAL NOT NULL,
    last_difficulty REAL NOT NULL,
    new_difficulty REAL NOT NULL,
    response_time_ms INTEGER NOT NULL,
    reviewed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_card_id ON reviews(card_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_at ON reviews(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_reviews_session_id ON reviews(session_id);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Schema version tracker
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
);
