use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::database::connection::Database;
use crate::database::repositories::CardRepository;
use crate::domain::card::Card;
use crate::errors::{AppError, AppResult};
use crate::services::media_service::MediaService;
use super::importers::epub_importer::EpubImporter;
use super::importers::mobi_importer::MobiImporter;
use super::importers::pdf_importer::PdfImporter;
use super::importers::txt_importer::TxtImporter;
use super::importers::{BookImporter, ImportError};
use super::segmenter::Segmenter;
use super::word_lookup::{WordLookupResult, WordLookupService};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookDto {
    pub id: i64,
    pub title: String,
    pub author: Option<String>,
    pub source_format: String,
    pub original_filename: String,
    pub cover_image_path: Option<String>,
    pub cover_base64: Option<String>,
    pub total_passages: i64,
    pub last_passage_index: i64,
    pub imported_at: String,
    pub progress_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassageDto {
    pub id: i64,
    pub book_id: i64,
    pub chapter_title: Option<String>,
    pub passage_index: i64,
    pub raw_text: String,
    pub word_count: i64,
    pub total_passages: i64,
}

pub struct ReadingService {
    db: Database,
    media_service: Arc<MediaService>,
    word_lookup: WordLookupService,
}

impl ReadingService {
    pub fn new(db: Database, media_service: Arc<MediaService>) -> Self {
        let conn = db.get_connection();
        let _ = Self::ensure_tables(&conn);
        drop(conn);

        Self {
            db,
            media_service,
            word_lookup: WordLookupService::new(),
        }
    }

    /// Ensure books and passages tables exist
    pub fn ensure_tables(conn: &rusqlite::Connection) -> AppResult<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS books (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                title               TEXT NOT NULL,
                author              TEXT,
                source_format       TEXT NOT NULL CHECK (source_format IN ('epub', 'pdf', 'txt', 'mobi_drm_free')),
                original_filename   TEXT NOT NULL,
                cover_image_path    TEXT,
                total_passages      INTEGER NOT NULL DEFAULT 0,
                last_passage_index  INTEGER NOT NULL DEFAULT 0,
                imported_at         TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS passages (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                chapter_title   TEXT,
                passage_index   INTEGER NOT NULL,
                raw_text        TEXT NOT NULL,
                word_count      INTEGER NOT NULL,
                UNIQUE(book_id, passage_index)
            )",
            [],
        )?;

        // Safely check if cards table has source tracking columns
        if let Ok(mut pragma_stmt) = conn.prepare("PRAGMA table_info(cards)") {
            let columns: Vec<String> = pragma_stmt
                .query_map([], |r| r.get::<_, String>(1))
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
                .unwrap_or_default();

            if !columns.contains(&"source_book_id".to_string()) {
                let _ = conn.execute("ALTER TABLE cards ADD COLUMN source_book_id INTEGER REFERENCES books(id) ON DELETE SET NULL", []);
            }
            if !columns.contains(&"source_passage_id".to_string()) {
                let _ = conn.execute("ALTER TABLE cards ADD COLUMN source_passage_id INTEGER REFERENCES passages(id) ON DELETE SET NULL", []);
            }
        }

        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_passages_book ON passages(book_id, passage_index)", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_cards_source_book ON cards(source_book_id)", []);

        Ok(())
    }

    /// Import and parse a book file (EPUB / PDF / TXT / MOBI)
    pub fn import_book(&self, file_path: &str, file_bytes: &[u8]) -> AppResult<BookDto> {
        let conn_init = self.db.get_connection();
        let _ = Self::ensure_tables(&conn_init);
        drop(conn_init);

        let filename = std::path::Path::new(file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("book");

        let ext = std::path::Path::new(file_path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        // 1. Choose importer based on extension
        let parsed_book = match ext.as_str() {
            "epub" => {
                let importer = EpubImporter::new();
                importer.parse(file_bytes, filename)
            }
            "pdf" => {
                let importer = PdfImporter::new();
                importer.parse(file_bytes, filename)
            }
            "txt" => {
                let importer = TxtImporter::new();
                importer.parse(file_bytes, filename)
            }
            "mobi" | "azw" | "azw3" => {
                let importer = MobiImporter::new();
                importer.parse(file_bytes, filename)
            }
            _ => Err(ImportError::UnsupportedOrCorrupted(format!("Unsupported format: .{}", ext))),
        }.map_err(|e| AppError::Validation(e.to_string()))?;

        // 2. Segment into short passages
        let segmenter = Segmenter::new(Some(120));
        let passages = segmenter.segment_book(&parsed_book);

        if passages.is_empty() {
            return Err(AppError::Validation("No readable passages could be extracted from this file.".to_string()));
        }

        // 3. Save cover image if available
        let mut cover_image_path = None;
        let mut cover_base64 = None;

        if let Some((img_bytes, mime)) = parsed_book.cover_image {
            let ext_name = if mime.contains("png") { "png" } else { "jpg" };
            let img_name = format!("cover_{}.{}", Uuid::new_v4(), ext_name);
            if let Ok(media_item) = self.media_service.add_media(&img_name, &img_bytes, &mime) {
                cover_base64 = self.media_service.get_media_base64(&media_item.filename).ok();
                cover_image_path = Some(media_item.filename);
            }
        }

        // 4. Save Book and Passages in SQLite
        let mut conn = self.db.get_connection();
        let tx = conn.transaction()?;

        let now = Utc::now().to_rfc3339();
        let total_passages = passages.len() as i64;

        tx.execute(
            "INSERT INTO books (
                title, author, source_format, original_filename, cover_image_path, 
                total_passages, last_passage_index, imported_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)",
            params![
                parsed_book.title,
                parsed_book.author,
                parsed_book.source_format,
                filename,
                cover_image_path,
                total_passages,
                now
            ],
        )?;

        let book_id = tx.last_insert_rowid();

        for p in &passages {
            tx.execute(
                "INSERT INTO passages (
                    book_id, chapter_title, passage_index, raw_text, word_count
                ) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    book_id,
                    p.chapter_title,
                    p.passage_index,
                    p.raw_text,
                    p.word_count
                ],
            )?;
        }

        tx.commit()?;

        Ok(BookDto {
            id: book_id,
            title: parsed_book.title,
            author: parsed_book.author,
            source_format: parsed_book.source_format,
            original_filename: filename.to_string(),
            cover_image_path,
            cover_base64,
            total_passages,
            last_passage_index: 0,
            imported_at: now,
            progress_percent: 0.0,
        })
    }

    /// List all imported books
    pub fn list_books(&self) -> AppResult<Vec<BookDto>> {
        let conn = self.db.get_connection();
        let _ = Self::ensure_tables(&conn);

        let mut stmt = conn.prepare(
            "SELECT id, title, author, source_format, original_filename, cover_image_path, 
                    total_passages, last_passage_index, imported_at 
             FROM books 
             ORDER BY id DESC",
        )?;

        let rows = stmt.query_map([], |r| {
            let total: i64 = r.get(6)?;
            let last: i64 = r.get(7)?;
            let progress = if total > 0 {
                ((last as f64 + 1.0) / total as f64 * 100.0).clamp(0.0, 100.0)
            } else {
                0.0
            };

            let cover_path: Option<String> = r.get(5)?;
            let cover_b64 = cover_path.as_ref().and_then(|p| self.media_service.get_media_base64(p).ok());

            Ok(BookDto {
                id: r.get(0)?,
                title: r.get(1)?,
                author: r.get(2)?,
                source_format: r.get(3)?,
                original_filename: r.get(4)?,
                cover_image_path: cover_path,
                cover_base64: cover_b64,
                total_passages: total,
                last_passage_index: last,
                imported_at: r.get(8)?,
                progress_percent: (progress * 10.0).round() / 10.0,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    /// Get a specific passage
    pub fn get_passage(&self, book_id: i64, passage_index: i64) -> AppResult<PassageDto> {
        let conn = self.db.get_connection();
        let total_passages: i64 = conn.query_row(
            "SELECT total_passages FROM books WHERE id = ?1",
            params![book_id],
            |r| r.get(0),
        ).map_err(|_| AppError::NotFound(format!("Book #{} not found", book_id)))?;

        let (id, chapter_title, raw_text, word_count) = conn.query_row(
            "SELECT id, chapter_title, raw_text, word_count 
             FROM passages 
             WHERE book_id = ?1 AND passage_index = ?2",
            params![book_id, passage_index],
            |r| Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, Option<String>>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, i64>(3)?,
            )),
        ).map_err(|_| AppError::NotFound(format!("Passage index {} not found in book {}", passage_index, book_id)))?;

        Ok(PassageDto {
            id,
            book_id,
            chapter_title,
            passage_index,
            raw_text,
            word_count,
            total_passages,
        })
    }

    /// Save reading progress
    pub fn save_progress(&self, book_id: i64, passage_index: i64) -> AppResult<()> {
        let conn = self.db.get_connection();
        conn.execute(
            "UPDATE books SET last_passage_index = ?1 WHERE id = ?2",
            params![passage_index, book_id],
        )?;
        Ok(())
    }

    /// Lookup word definition and Arabic translation
    pub fn lookup_word(&self, word: &str, context_sentence: &str) -> AppResult<WordLookupResult> {
        Ok(self.word_lookup.lookup(word, context_sentence, &self.db))
    }

    /// Create Cloze flashcard from tapped word with complete original sentence
    pub fn create_card_from_tap(
        &self,
        passage_id: i64,
        tapped_word: &str,
        sentence: &str,
    ) -> AppResult<Card> {
        let clean_word = WordLookupService::clean_term(tapped_word);
        if clean_word.is_empty() {
            return Err(AppError::Validation("Cannot create flashcard from empty word".to_string()));
        }

        // 1. Create Cloze front by wrapping word with {{c1::word}}
        let cloze_front = if sentence.contains(&clean_word) {
            sentence.replacen(&clean_word, &format!("{{{{c1::{}}}}}", clean_word), 1)
        } else if sentence.to_lowercase().contains(&clean_word.to_lowercase()) {
            // Case-insensitive match replacement
            let lower_sentence = sentence.to_lowercase();
            let lower_word = clean_word.to_lowercase();
            if let Some(idx) = lower_sentence.find(&lower_word) {
                let matched_text = &sentence[idx..idx + clean_word.len()];
                format!(
                    "{}{{{{{{c1::{}}}}}}}{}",
                    &sentence[..idx],
                    matched_text,
                    &sentence[idx + clean_word.len()..]
                )
            } else {
                format!("{{{{c1::{}}}}} in context: {}", clean_word, sentence)
            }
        } else {
            format!("{{{{c1::{}}}}} in context: {}", clean_word, sentence)
        };

        // 2. Lookup definition and Arabic translation BEFORE acquiring database lock
        let lookup = self.lookup_word(&clean_word, sentence).unwrap_or_else(|_| WordLookupResult {
            word: clean_word.clone(),
            definition_en: None,
            translation_ar: None,
            example_sentence: None,
            source: crate::reading::word_lookup::WordLookupSource::None,
        });

        let mut back_parts = Vec::new();
        if let Some(ar) = lookup.translation_ar {
            back_parts.push(ar);
        }
        if let Some(en) = lookup.definition_en {
            back_parts.push(en);
        }
        if back_parts.is_empty() {
            back_parts.push(clean_word.clone());
        }
        let back = back_parts.join("\n\n");

        // 3. Acquire database connection for insertion
        let conn = self.db.get_connection();

        let book_id: i64 = conn.query_row(
            "SELECT book_id FROM passages WHERE id = ?1",
            params![passage_id],
            |r| r.get(0),
        ).map_err(|_| AppError::NotFound(format!("Passage #{} not found", passage_id)))?;

        // 4. Ensure a target deck exists (find or create "Reading & Stories" deck)
        let deck_id: String = match conn.query_row(
            "SELECT id FROM decks WHERE name = 'Reading & Stories' OR name = 'القراءة والقصص' LIMIT 1",
            [],
            |r| r.get(0),
        ) {
            Ok(id) => id,
            Err(_) => {
                // If not found, use first existing deck or create a new dedicated reading deck
                let first_deck: Option<String> = conn.query_row(
                    "SELECT id FROM decks ORDER BY created_at ASC LIMIT 1",
                    [],
                    |r| r.get(0),
                ).ok();

                if let Some(f_id) = first_deck {
                    f_id
                } else {
                    let new_deck_id = format!("deck-{}", Uuid::new_v4());
                    let now = Utc::now().to_rfc3339();
                    conn.execute(
                        "INSERT INTO decks (id, parent_id, name, description, color, icon, priority, created_at, updated_at)
                         VALUES (?1, NULL, 'Reading & Stories', 'Flashcards created from interactive reading', '#10b981', 'book-open', 1, ?2, ?3)",
                        params![new_deck_id, now, now],
                    )?;
                    new_deck_id
                }
            }
        };

        // 5. Insert Card with source_book_id and source_passage_id
        let card_id = format!("card-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO cards (
                id, deck_id, card_type, front, back, notes, state, stability, difficulty, 
                reps, lapses, review_count, last_review, next_review, interval_days, ease_factor, 
                suspended, buried, created_at, updated_at, source_book_id, source_passage_id
            ) VALUES (
                ?1, ?2, 'cloze', ?3, ?4, ?5, 'new', 0.0, 0.0, 
                0, 0, 0, NULL, ?6, 0.0, 2.5, 
                0, 0, ?7, ?8, ?9, ?10
            )",
            params![
                card_id,
                deck_id,
                cloze_front,
                back,
                format!("Imported from Interactive Reading (Book #{})", book_id),
                now,
                now,
                now,
                book_id,
                passage_id
            ],
        )?;

        // Set tags
        CardRepository::set_tags_for_card(
            &conn,
            &card_id,
            &["reading".to_string(), "vocabulary".to_string()],
        )?;

        CardRepository::get_by_id(&conn, &card_id)
    }

    /// Delete a book and all associated passages
    pub fn delete_book(&self, book_id: i64) -> AppResult<()> {
        let conn = self.db.get_connection();
        let cover_path: Option<String> = conn.query_row(
            "SELECT cover_image_path FROM books WHERE id = ?1",
            params![book_id],
            |r| r.get(0),
        ).ok().flatten();

        conn.execute("DELETE FROM books WHERE id = ?1", params![book_id])?;

        if let Some(path) = cover_path {
            if let Ok(full_path) = self.media_service.get_media_path(&path) {
                let _ = std::fs::remove_file(full_path);
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::migrations::run_migrations;
    use crate::domain::card::CardType;

    #[test]
    fn test_create_cloze_card_from_reading() {
        let db = Database::in_memory().expect("in-memory db");
        run_migrations(&db).expect("migrations");

        let media_svc = Arc::new(MediaService::new(db.clone()).expect("media"));
        let reading_svc = ReadingService::new(db.clone(), media_svc);

        // Import a sample text
        let sample_txt = b"The detective observed the clue carefully. It was conclusive evidence.";
        let book = reading_svc.import_book("sample.txt", sample_txt).expect("import txt");

        let passage = reading_svc.get_passage(book.id, 0).expect("get passage");
        let card = reading_svc.create_card_from_tap(
            passage.id,
            "detective",
            "The detective observed the clue carefully.",
        ).expect("create card");

        assert_eq!(card.card_type, CardType::Cloze);
        assert!(card.front.contains("{{c1::detective}}"));
        assert!(card.tags.contains(&"reading".to_string()));
    }
}
