use std::sync::Arc;
use chrono::Utc;
use rand::seq::SliceRandom;
use rusqlite::{params, Connection, Row};

use crate::database::connection::Database;
use crate::database::repositories::CardRepository;
use crate::domain::card::Card;
use crate::errors::{AppError, AppResult};
use super::crypto::{decrypt_api_key, encrypt_api_key};
use super::models::*;
use super::providers::create_provider;
use super::question_generator::QuestionGenerator;

pub struct AiPracticeService {
    db: Database,
    question_gen: Arc<QuestionGenerator>,
}

impl AiPracticeService {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            question_gen: Arc::new(QuestionGenerator::new()),
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Provider Management
    // ─────────────────────────────────────────────────────────────────────────

    pub fn save_provider(&self, input: AiProviderInput) -> AppResult<AiProviderDto> {
        let conn = self.db.get_connection();
        let now = Utc::now().to_rfc3339();

        let clean_key = input.api_key.as_deref().unwrap_or("").trim();
        let encrypted_key = if !clean_key.is_empty() {
            encrypt_api_key(clean_key)
        } else {
            // Keep existing key if not provided during edit
            let existing_key: Option<String> = conn
                .query_row(
                    "SELECT api_key_encrypted FROM ai_providers WHERE provider_key = ?1",
                    params![input.provider_key],
                    |r| r.get(0),
                )
                .ok();
            existing_key.unwrap_or_default()
        };

        let is_active = input.is_active.unwrap_or(false);
        let is_enabled = input.is_enabled.unwrap_or(true);

        if is_active {
            // Unset other active providers
            conn.execute("UPDATE ai_providers SET is_active = 0", [])?;
        }

        conn.execute(
            "INSERT INTO ai_providers (
                provider_key, display_name, provider_type, base_url, api_key_encrypted, 
                model_id, is_active, is_enabled, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(provider_key) DO UPDATE SET
                display_name = excluded.display_name,
                provider_type = excluded.provider_type,
                base_url = excluded.base_url,
                api_key_encrypted = CASE WHEN excluded.api_key_encrypted != '' THEN excluded.api_key_encrypted ELSE ai_providers.api_key_encrypted END,
                model_id = excluded.model_id,
                is_active = excluded.is_active,
                is_enabled = excluded.is_enabled,
                updated_at = excluded.updated_at",
            params![
                input.provider_key,
                input.display_name,
                input.provider_type,
                input.base_url,
                encrypted_key,
                input.model_id,
                if is_active { 1 } else { 0 },
                if is_enabled { 1 } else { 0 },
                now
            ],
        )?;

        self.get_provider_by_key(&conn, &input.provider_key)
    }

    pub fn test_provider(&self, provider_id: i64) -> AppResult<ProviderTestResult> {
        let conn = self.db.get_connection();
        let (provider_key, provider_type, base_url, encrypted_key, model_id) = conn.query_row(
            "SELECT provider_key, provider_type, base_url, api_key_encrypted, model_id FROM ai_providers WHERE id = ?1",
            params![provider_id],
            |r| Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                r.get::<_, Option<String>>(4)?,
            )),
        ).map_err(|_| AppError::NotFound(format!("AI Provider #{provider_id} not found")))?;

        let raw_key = decrypt_api_key(&encrypted_key);
        let provider = create_provider(
            &provider_key,
            &provider_type,
            base_url.as_deref(),
            &raw_key,
            model_id.as_deref(),
        )?;

        let result = provider.test_connection()?;
        let now = Utc::now().to_rfc3339();

        let status_str = if result.success { "ok" } else { "failed" };
        conn.execute(
            "UPDATE ai_providers SET last_test_status = ?1, last_test_at = ?2 WHERE id = ?3",
            params![status_str, now, provider_id],
        )?;

        Ok(result)
    }

    pub fn list_models(&self, provider_id: i64) -> AppResult<Vec<String>> {
        let conn = self.db.get_connection();
        let (provider_key, provider_type, base_url, encrypted_key, model_id) = conn.query_row(
            "SELECT provider_key, provider_type, base_url, api_key_encrypted, model_id FROM ai_providers WHERE id = ?1",
            params![provider_id],
            |r| Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                r.get::<_, Option<String>>(4)?,
            )),
        ).map_err(|_| AppError::NotFound(format!("AI Provider #{provider_id} not found")))?;

        let raw_key = decrypt_api_key(&encrypted_key);
        let provider = create_provider(
            &provider_key,
            &provider_type,
            base_url.as_deref(),
            &raw_key,
            model_id.as_deref(),
        )?;

        provider.list_models()
    }

    pub fn list_providers(&self) -> AppResult<Vec<AiProviderDto>> {
        let conn = self.db.get_connection();
        let mut stmt = conn.prepare(
            "SELECT id, provider_key, display_name, provider_type, base_url, model_id, 
                    api_key_encrypted, is_active, is_enabled, last_test_status, last_test_at, created_at, updated_at 
             FROM ai_providers 
             ORDER BY provider_type ASC, id ASC",
        )?;

        let rows = stmt.query_map([], |r| Self::row_to_provider_dto(r))?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn set_active_provider(&self, provider_id: i64) -> AppResult<()> {
        let conn = self.db.get_connection();
        conn.execute("UPDATE ai_providers SET is_active = 0", [])?;
        let updated = conn.execute(
            "UPDATE ai_providers SET is_active = 1, is_enabled = 1 WHERE id = ?1",
            params![provider_id],
        )?;

        if updated == 0 {
            return Err(AppError::NotFound(format!("AI Provider #{provider_id} not found")));
        }
        Ok(())
    }

    pub fn delete_provider(&self, provider_id: i64) -> AppResult<()> {
        let conn = self.db.get_connection();
        let prov_type: String = conn.query_row(
            "SELECT provider_type FROM ai_providers WHERE id = ?1",
            params![provider_id],
            |r| r.get(0),
        ).map_err(|_| AppError::NotFound(format!("Provider #{provider_id} not found")))?;

        if prov_type == "preset" {
            // Preset providers are reset rather than deleted
            conn.execute(
                "UPDATE ai_providers SET api_key_encrypted = '', is_active = 0, is_enabled = 0, last_test_status = 'untested' WHERE id = ?1",
                params![provider_id],
            )?;
        } else {
            conn.execute("DELETE FROM ai_providers WHERE id = ?1", params![provider_id])?;
        }

        Ok(())
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Practice Filter & Setup Options
    // ─────────────────────────────────────────────────────────────────────────

    pub fn get_filter_options(&self) -> AppResult<FilterOptionsDto> {
        let conn = self.db.get_connection();

        // 1. Decks with card count
        let mut deck_stmt = conn.prepare(
            "SELECT d.id, d.name, COUNT(c.id) as card_count 
             FROM decks d 
             LEFT JOIN cards c ON d.id = c.deck_id 
             GROUP BY d.id, d.name 
             ORDER BY d.name ASC",
        )?;
        let decks = deck_stmt.query_map([], |r| {
            Ok(DeckFilterOption {
                id: r.get(0)?,
                name: r.get(1)?,
                card_count: r.get::<_, i64>(2)? as u32,
            })
        })?.filter_map(|r| r.ok()).collect();

        // 2. Tags with card count
        let mut tag_stmt = conn.prepare(
            "SELECT t.name, COUNT(ct.card_id) as count 
             FROM tags t 
             JOIN card_tags ct ON t.id = ct.tag_id 
             GROUP BY t.id, t.name 
             ORDER BY t.name ASC",
        )?;
        let tags = tag_stmt.query_map([], |r| {
            Ok(TagFilterOption {
                name: r.get(0)?,
                card_count: r.get::<_, i64>(1)? as u32,
            })
        })?.filter_map(|r| r.ok()).collect();

        // 3. Specific cards list
        let mut card_stmt = conn.prepare(
            "SELECT c.id, c.front, c.back, d.name as deck_name, c.created_at 
             FROM cards c 
             JOIN decks d ON c.deck_id = d.id 
             ORDER BY c.created_at DESC 
             LIMIT 500",
        )?;
        let specific_cards = card_stmt.query_map([], |r| {
            Ok(CardFilterOption {
                id: r.get(0)?,
                front: r.get(1)?,
                back: r.get(2)?,
                deck_name: r.get(3)?,
                created_at: r.get(4)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        // 4. Min / Max created_at date
        let (min_date, max_date, total_count): (Option<String>, Option<String>, i64) = conn.query_row(
            "SELECT MIN(created_at), MAX(created_at), COUNT(1) FROM cards",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;

        // 5. Active provider
        let active_provider = conn.query_row(
            "SELECT id, provider_key, display_name, provider_type, base_url, model_id, 
                    api_key_encrypted, is_active, is_enabled, last_test_status, last_test_at, created_at, updated_at 
             FROM ai_providers 
             WHERE is_active = 1 LIMIT 1",
            [],
            |r| Self::row_to_provider_dto(r),
        ).ok();

        Ok(FilterOptionsDto {
            decks,
            tags,
            specific_cards,
            min_date_added: min_date,
            max_date_added: max_date,
            total_cards_count: total_count as u32,
            active_provider,
        })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Practice Session Execution
    // ─────────────────────────────────────────────────────────────────────────

    pub fn start_session(&self, filter: PracticeFilter, question_count: u32) -> AppResult<PracticeSessionDto> {
        let conn = self.db.get_connection();

        // 1. Get active AI provider
        let (provider_id, provider_key, provider_type, base_url, encrypted_key, model_id, display_name) = conn.query_row(
            "SELECT id, provider_key, provider_type, base_url, api_key_encrypted, model_id, display_name 
             FROM ai_providers 
             WHERE is_active = 1 AND is_enabled = 1 
             LIMIT 1",
            [],
            |r| Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Option<String>>(3)?,
                r.get::<_, Option<String>>(4)?.unwrap_or_default(),
                r.get::<_, Option<String>>(5)?,
                r.get::<_, String>(6)?,
            )),
        ).map_err(|_| AppError::Validation("لا يوجد مزود ذكاء اصطناعي نشط. يرجى ضبط وتفعيل أحد المزودين من تبويب الإعدادات أولاً.".to_string()))?;

        let raw_key = decrypt_api_key(&encrypted_key);
        let provider = create_provider(
            &provider_key,
            &provider_type,
            base_url.as_deref(),
            &raw_key,
            model_id.as_deref(),
        )?;

        // 2. Resolve target cards based on filter
        let mut target_cards = self.resolve_filtered_cards(&conn, &filter)?;
        if target_cards.is_empty() {
            return Err(AppError::Validation("لم يتم العثور على أي بطاقات تطابق معايير الفلترة المحددة.".to_string()));
        }

        // Shuffle cards for variety
        let mut rng = rand::thread_rng();
        target_cards.shuffle(&mut rng);

        let max_q = (question_count as usize).clamp(1, 30).min(target_cards.len());
        target_cards.truncate(max_q);

        // 3. Create Session in SQLite
        let now = Utc::now().to_rfc3339();
        let payload_json = serde_json::to_string(&filter).unwrap_or_default();

        conn.execute(
            "INSERT INTO ai_practice_sessions (
                provider_id, filter_type, filter_payload, question_count, correct_count, status, started_at
            ) VALUES (?1, ?2, ?3, ?4, 0, 'in_progress', ?5)",
            params![
                provider_id,
                filter.filter_type,
                payload_json,
                target_cards.len() as u32,
                now
            ],
        )?;

        let session_id = conn.last_insert_rowid();
        let bypass_cache = filter.bypass_cache.unwrap_or(false);

        // 4. Generate questions for each card
        let mut question_dtos = Vec::new();
        let active_model = model_id.as_deref().unwrap_or("default");

        for card in &target_cards {
            let gen_result = self.question_gen.generate_for_card(
                &conn,
                card,
                provider.as_ref(),
                active_model,
                bypass_cache,
            )?;

            // Insert into ai_practice_questions
            conn.execute(
                "INSERT INTO ai_practice_questions (
                    session_id, card_id, question_text, option_a, option_b, option_c, option_d, 
                    correct_option, explanation, grounded_sentence, source_citation, source_url, 
                    is_source_verified, raw_model_response, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    session_id,
                    card.id,
                    gen_result.question_text,
                    gen_result.option_a,
                    gen_result.option_b,
                    gen_result.option_c,
                    gen_result.option_d,
                    gen_result.correct_option,
                    gen_result.explanation,
                    gen_result.grounded_sentence,
                    gen_result.source_citation,
                    gen_result.source_url,
                    if gen_result.is_source_verified { 1 } else { 0 },
                    gen_result.raw_response,
                    now
                ],
            )?;

            let question_id = conn.last_insert_rowid();

            // Save in cache
            let _ = conn.execute(
                "INSERT OR REPLACE INTO ai_question_cache (content_hash, question_id, created_at) VALUES (?1, ?2, ?3)",
                params![gen_result.content_hash, question_id, now],
            );

            // Safe DTO for frontend — without correct_option!
            question_dtos.push(PracticeQuestionDto {
                id: question_id,
                session_id,
                card_id: card.id.clone(),
                card_front: card.front.clone(),
                card_back: card.back.clone(),
                question_text: gen_result.question_text,
                option_a: gen_result.option_a,
                option_b: gen_result.option_b,
                option_c: gen_result.option_c,
                option_d: gen_result.option_d,
                grounded_sentence: gen_result.grounded_sentence,
                source_citation: gen_result.source_citation,
                source_url: gen_result.source_url,
                is_source_verified: gen_result.is_source_verified,
                user_answer: None,
                is_correct: None,
                explanation: None,
            });
        }

        Ok(PracticeSessionDto {
            id: session_id,
            provider_id: Some(provider_id),
            provider_name: Some(display_name),
            filter_type: filter.filter_type,
            question_count: question_dtos.len() as u32,
            correct_count: 0,
            status: "in_progress".to_string(),
            started_at: now,
            completed_at: None,
            questions: question_dtos,
        })
    }

    pub fn submit_answer(&self, question_id: i64, chosen: String) -> AppResult<AnswerResultDto> {
        let conn = self.db.get_connection();
        let clean_chosen = chosen.trim().to_lowercase();

        // 1. Get question details
        let (session_id, correct_option, explanation) = conn.query_row(
            "SELECT session_id, correct_option, explanation FROM ai_practice_questions WHERE id = ?1",
            params![question_id],
            |r| Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?.unwrap_or_default(),
            )),
        ).map_err(|_| AppError::NotFound(format!("Question #{question_id} not found")))?;

        let is_correct = clean_chosen == correct_option.trim().to_lowercase();
        let now = Utc::now().to_rfc3339();

        // 2. Update question answer
        conn.execute(
            "UPDATE ai_practice_questions 
             SET user_answer = ?1, is_correct = ?2, answered_at = ?3 
             WHERE id = ?4",
            params![
                clean_chosen,
                if is_correct { 1 } else { 0 },
                now,
                question_id
            ],
        )?;

        // 3. Recalculate session stats
        let (correct_count, total_count, answered_count): (i64, i64, i64) = conn.query_row(
            "SELECT 
                COALESCE(SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END), 0),
                COUNT(1),
                COALESCE(SUM(CASE WHEN user_answer IS NOT NULL THEN 1 ELSE 0 END), 0)
             FROM ai_practice_questions 
             WHERE session_id = ?1",
            params![session_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;

        let session_completed = answered_count >= total_count;
        if session_completed {
            conn.execute(
                "UPDATE ai_practice_sessions 
                 SET correct_count = ?1, status = 'completed', completed_at = ?2 
                 WHERE id = ?3",
                params![correct_count, now, session_id],
            )?;
        } else {
            conn.execute(
                "UPDATE ai_practice_sessions 
                 SET correct_count = ?1 
                 WHERE id = ?2",
                params![correct_count, session_id],
            )?;
        }

        Ok(AnswerResultDto {
            question_id,
            is_correct,
            correct_option,
            explanation,
            user_answer: clean_chosen,
            session_correct_count: correct_count as u32,
            session_completed,
        })
    }

    pub fn get_summary(&self, session_id: i64) -> AppResult<SessionSummaryDto> {
        let conn = self.db.get_connection();

        let (started_at, completed_at, q_count, c_count): (String, Option<String>, i64, i64) = conn.query_row(
            "SELECT started_at, completed_at, question_count, correct_count 
             FROM ai_practice_sessions 
             WHERE id = ?1",
            params![session_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        ).map_err(|_| AppError::NotFound(format!("Session #{session_id} not found")))?;

        let mut stmt = conn.prepare(
            "SELECT q.id, q.card_id, c.front, c.back, q.question_text, 
                    q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, 
                    q.user_answer, q.is_correct, q.explanation, q.grounded_sentence, 
                    q.source_citation, q.source_url, q.is_source_verified 
             FROM ai_practice_questions q 
             JOIN cards c ON q.card_id = c.id 
             WHERE q.session_id = ?1 
             ORDER BY q.id ASC",
        )?;

        let items = stmt.query_map(params![session_id], |r| {
            let is_correct_int: Option<i32> = r.get(11)?;
            let is_ver_int: i32 = r.get(16)?;
            Ok(QuestionSummaryItem {
                id: r.get(0)?,
                card_id: r.get(1)?,
                card_front: r.get(2)?,
                card_back: r.get(3)?,
                question_text: r.get(4)?,
                option_a: r.get(5)?,
                option_b: r.get(6)?,
                option_c: r.get(7)?,
                option_d: r.get(8)?,
                correct_option: r.get(9)?,
                user_answer: r.get(10)?,
                is_correct: is_correct_int.map(|v| v != 0),
                explanation: r.get(12)?,
                grounded_sentence: r.get(13)?,
                source_citation: r.get(14)?,
                source_url: r.get(15)?,
                is_source_verified: is_ver_int != 0,
            })
        })?.filter_map(|r| r.ok()).collect();

        let total = q_count as u32;
        let correct = c_count as u32;
        let incorrect = total.saturating_sub(correct);
        let accuracy = if total > 0 {
            (correct as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        Ok(SessionSummaryDto {
            session_id,
            total_questions: total,
            correct_count: correct,
            incorrect_count: incorrect,
            accuracy_percentage: (accuracy * 10.0).round() / 10.0,
            started_at,
            completed_at,
            questions: items,
        })
    }

    pub fn list_history(&self, limit: u32) -> AppResult<Vec<PracticeSessionDto>> {
        let conn = self.db.get_connection();
        let mut stmt = conn.prepare(
            "SELECT s.id, s.provider_id, p.display_name, s.filter_type, s.question_count, 
                    s.correct_count, s.status, s.started_at, s.completed_at 
             FROM ai_practice_sessions s 
             LEFT JOIN ai_providers p ON s.provider_id = p.id 
             ORDER BY s.started_at DESC 
             LIMIT ?1",
        )?;

        let sessions = stmt.query_map(params![limit], |r| {
            Ok(PracticeSessionDto {
                id: r.get(0)?,
                provider_id: r.get(1)?,
                provider_name: r.get(2)?,
                filter_type: r.get(3)?,
                question_count: r.get::<_, i64>(4)? as u32,
                correct_count: r.get::<_, i64>(5)? as u32,
                status: r.get(6)?,
                started_at: r.get(7)?,
                completed_at: r.get(8)?,
                questions: vec![],
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(sessions)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal Helper Methods
    // ─────────────────────────────────────────────────────────────────────────

    fn resolve_filtered_cards(&self, conn: &Connection, filter: &PracticeFilter) -> AppResult<Vec<Card>> {
        match filter.filter_type.as_str() {
            "specific_cards" => {
                let ids = filter.card_ids.as_deref().unwrap_or(&[]);
                if ids.is_empty() {
                    return Ok(vec![]);
                }
                let mut cards = Vec::new();
                for id in ids {
                    if let Ok(c) = CardRepository::get_by_id(conn, id) {
                        cards.push(c);
                    }
                }
                Ok(cards)
            }
            "deck" => {
                let deck_id = filter.deck_id.as_deref().ok_or_else(|| AppError::Validation("Deck ID is required for deck filter".to_string()))?;
                CardRepository::get_by_deck(conn, deck_id)
            }
            "tag" => {
                let tag = filter.tag.as_deref().ok_or_else(|| AppError::Validation("Tag is required for tag filter".to_string()))?;
                let mut stmt = conn.prepare(
                    "SELECT c.id, c.deck_id, c.card_type, c.front, c.back, c.notes, c.state, 
                            c.stability, c.difficulty, c.reps, c.lapses, c.review_count, 
                            c.last_review, c.next_review, c.interval_days, c.ease_factor, 
                            c.suspended, c.buried, c.created_at, c.updated_at 
                     FROM cards c 
                     JOIN card_tags ct ON c.id = ct.card_id 
                     JOIN tags t ON ct.tag_id = t.id 
                     WHERE t.name = ?1 
                     ORDER BY c.created_at DESC",
                )?;
                let rows = stmt.query_map(params![tag.to_lowercase()], |r| CardRepository::row_to_card(conn, r))?;
                let mut cards = Vec::new();
                for r in rows {
                    cards.push(r?);
                }
                Ok(cards)
            }
            "date_added" => {
                let from = filter.date_from.as_deref().unwrap_or("1970-01-01");
                let to = filter.date_to.as_deref().unwrap_or("2099-12-31");
                let mut stmt = conn.prepare(
                    "SELECT id, deck_id, card_type, front, back, notes, state, 
                            stability, difficulty, reps, lapses, review_count, 
                            last_review, next_review, interval_days, ease_factor, 
                            suspended, buried, created_at, updated_at 
                     FROM cards 
                     WHERE date(created_at) >= date(?1) AND date(created_at) <= date(?2) 
                     ORDER BY created_at DESC",
                )?;
                let rows = stmt.query_map(params![from, to], |r| CardRepository::row_to_card(conn, r))?;
                let mut cards = Vec::new();
                for r in rows {
                    cards.push(r?);
                }
                Ok(cards)
            }
            "all_due" => {
                CardRepository::get_all_due_cards(conn, 50)
            }
            _ => {
                CardRepository::get_all_due_cards(conn, 30)
            }
        }
    }

    fn get_provider_by_key(&self, conn: &Connection, provider_key: &str) -> AppResult<AiProviderDto> {
        conn.query_row(
            "SELECT id, provider_key, display_name, provider_type, base_url, model_id, 
                    api_key_encrypted, is_active, is_enabled, last_test_status, last_test_at, created_at, updated_at 
             FROM ai_providers 
             WHERE provider_key = ?1",
            params![provider_key],
            |r| Self::row_to_provider_dto(r),
        ).map_err(|e| AppError::Database(e))
    }

    fn row_to_provider_dto(r: &Row) -> rusqlite::Result<AiProviderDto> {
        let enc_key: Option<String> = r.get(6)?;
        let has_key = enc_key.as_ref().map(|k| !k.trim().is_empty()).unwrap_or(false);
        let key_masked = if has_key {
            "••••••••••••••••".to_string()
        } else {
            String::new()
        };

        let is_act: i32 = r.get(7)?;
        let is_en: i32 = r.get(8)?;

        Ok(AiProviderDto {
            id: r.get(0)?,
            provider_key: r.get(1)?,
            display_name: r.get(2)?,
            provider_type: r.get(3)?,
            base_url: r.get(4)?,
            model_id: r.get(5)?,
            has_key,
            key_masked,
            is_active: is_act != 0,
            is_enabled: is_en != 0,
            last_test_status: r.get::<_, Option<String>>(9)?.unwrap_or_else(|| "untested".to_string()),
            last_test_at: r.get(10)?,
            created_at: r.get(11)?,
            updated_at: r.get(12)?,
        })
    }
}
