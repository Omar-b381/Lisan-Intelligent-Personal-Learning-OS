-- Migration 004: AI Practice (Providers, Sessions, Questions, Cache)

CREATE TABLE IF NOT EXISTS ai_providers (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_key        TEXT NOT NULL UNIQUE,      -- 'openai' | 'anthropic' | 'google' | 'deepseek' | 'groq' | 'custom_<uuid>'
    display_name        TEXT NOT NULL,
    provider_type       TEXT NOT NULL CHECK (provider_type IN ('preset', 'custom')),
    base_url            TEXT,                      -- NULL for built-in preset URLs, mandatory for custom
    api_key_encrypted   TEXT,                      -- Encrypted API key
    model_id            TEXT,                      -- Selected / custom model name
    is_active           INTEGER NOT NULL DEFAULT 0, -- Currently active provider for practice sessions
    is_enabled          INTEGER NOT NULL DEFAULT 1,
    last_test_status    TEXT CHECK (last_test_status IN ('untested', 'ok', 'failed')) DEFAULT 'untested',
    last_test_at        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_practice_sessions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id         INTEGER REFERENCES ai_providers(id) ON DELETE SET NULL,
    filter_type         TEXT NOT NULL CHECK (filter_type IN ('all_due', 'deck', 'tag', 'specific_cards', 'date_added')),
    filter_payload      TEXT,                       -- JSON string of filter parameters
    question_count      INTEGER NOT NULL,
    correct_count       INTEGER NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at          TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at        TEXT
);

CREATE TABLE IF NOT EXISTS ai_practice_questions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          INTEGER NOT NULL REFERENCES ai_practice_sessions(id) ON DELETE CASCADE,
    card_id             TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    question_text       TEXT NOT NULL,
    option_a            TEXT NOT NULL,
    option_b            TEXT NOT NULL,
    option_c            TEXT NOT NULL,
    option_d            TEXT NOT NULL,
    correct_option      TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
    explanation         TEXT,
    grounded_sentence   TEXT,                       -- Real sentence used
    source_citation     TEXT,                       -- e.g. "Tatoeba — Sentence #123456 (CC BY)" or "Free Dictionary API"
    source_url          TEXT,                       -- Direct link to source
    is_source_verified  INTEGER NOT NULL DEFAULT 0, -- 1 = verified from authentic external source, 0 = unverified AI generation
    user_answer         TEXT CHECK (user_answer IN ('a', 'b', 'c', 'd')),
    is_correct          INTEGER,
    answered_at         TEXT,
    raw_model_response  TEXT,                       -- Raw JSON response for auditing
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_question_cache (
    content_hash        TEXT PRIMARY KEY,           -- SHA-256(card_id + card_front + card_back + provider_key + model_id)
    question_id         INTEGER NOT NULL REFERENCES ai_practice_questions(id) ON DELETE CASCADE,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_practice_questions_session ON ai_practice_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_practice_questions_card ON ai_practice_questions(card_id);
CREATE INDEX IF NOT EXISTS idx_ai_practice_sessions_status ON ai_practice_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ai_providers_is_active ON ai_providers(is_active);
