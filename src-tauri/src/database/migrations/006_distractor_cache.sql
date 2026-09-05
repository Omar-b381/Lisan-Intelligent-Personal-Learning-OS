-- Migration 006: Distractor Cache and Tatoeba Sentence Cache

CREATE TABLE IF NOT EXISTS distractor_cache (
    word TEXT PRIMARY KEY,
    distractors TEXT NOT NULL,  -- JSON array, e.g. ["foo","bar","baz"]
    fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tatoeba_sentence_cache (
    cache_key TEXT PRIMARY KEY, -- e.g. "term:lang"
    sentence TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    license_note TEXT,
    fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_distractor_cache_fetched_at ON distractor_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_tatoeba_sentence_cache_fetched_at ON tatoeba_sentence_cache(fetched_at);
