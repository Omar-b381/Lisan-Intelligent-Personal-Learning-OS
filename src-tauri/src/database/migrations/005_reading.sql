-- Migration 005: Interactive Reading (Books, Passages, Card Source References)

CREATE TABLE IF NOT EXISTS books (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT NOT NULL,
    author              TEXT,
    source_format       TEXT NOT NULL CHECK (source_format IN ('epub', 'pdf', 'txt', 'mobi_drm_free')),
    original_filename   TEXT NOT NULL,
    cover_image_path    TEXT,
    total_passages      INTEGER NOT NULL DEFAULT 0,
    last_passage_index  INTEGER NOT NULL DEFAULT 0,
    imported_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS passages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_title   TEXT,
    passage_index   INTEGER NOT NULL,
    raw_text        TEXT NOT NULL,
    word_count      INTEGER NOT NULL,
    UNIQUE(book_id, passage_index)
);

-- Add optional source tracking columns to cards table
ALTER TABLE cards ADD COLUMN source_book_id INTEGER REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE cards ADD COLUMN source_passage_id INTEGER REFERENCES passages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_passages_book ON passages(book_id, passage_index);
CREATE INDEX IF NOT EXISTS idx_cards_source_book ON cards(source_book_id);
