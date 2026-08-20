-- Migration 003: Text-to-Speech (TTS) Audio Cache & Pronunciation Metadata

CREATE TABLE IF NOT EXISTS tts_audio (
    id TEXT PRIMARY KEY,
    text_hash TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL,
    language TEXT NOT NULL,
    provider TEXT NOT NULL,
    voice TEXT NOT NULL,
    speed REAL NOT NULL DEFAULT 1.0,
    pitch REAL NOT NULL DEFAULT 1.0,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    play_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tts_audio_text_hash ON tts_audio(text_hash);
CREATE INDEX IF NOT EXISTS idx_tts_audio_provider_lang ON tts_audio(provider, language);
CREATE INDEX IF NOT EXISTS idx_tts_audio_last_used ON tts_audio(last_used_at);

-- Optional language and audio_file fields on cards
ALTER TABLE cards ADD COLUMN language TEXT;
ALTER TABLE cards ADD COLUMN audio_file TEXT;
