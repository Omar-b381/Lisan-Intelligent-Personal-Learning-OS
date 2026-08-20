use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::domain::card::{
    Card, CardState, CardType, CardWithDeckInfo, CreateCardDto, UpdateCardDto,
};
use crate::domain::session::WeakCardInfo;
use crate::errors::{AppError, AppResult};

pub struct CardRepository;

impl CardRepository {
    pub fn row_to_card(conn: &Connection, row: &Row) -> rusqlite::Result<Card> {
        let id: String = row.get("id")?;
        let created_str: String = row.get("created_at")?;
        let updated_str: String = row.get("updated_at")?;
        let last_rev_str: Option<String> = row.get("last_review")?;
        let next_rev_str: Option<String> = row.get("next_review")?;

        let created_at = DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let updated_at = DateTime::parse_from_rfc3339(&updated_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let last_review = last_rev_str.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        });

        let next_review = next_rev_str.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        });

        let card_type_str: String = row.get("card_type")?;
        let state_str: String = row.get("state")?;

        let suspended_int: i32 = row.get("suspended")?;
        let buried_int: i32 = row.get("buried")?;

        let tags = Self::get_tags_for_card(conn, &id).unwrap_or_default();

        Ok(Card {
            id,
            deck_id: row.get("deck_id")?,
            card_type: CardType::from_str(&card_type_str),
            front: row.get("front")?,
            back: row.get("back")?,
            notes: row.get("notes")?,
            state: CardState::from_str(&state_str),
            stability: row.get("stability")?,
            difficulty: row.get("difficulty")?,
            reps: row.get("reps")?,
            lapses: row.get("lapses")?,
            review_count: row.get("review_count")?,
            last_review,
            next_review,
            interval_days: row.get("interval_days")?,
            ease_factor: row.get("ease_factor")?,
            suspended: suspended_int != 0,
            buried: buried_int != 0,
            tags,
            created_at,
            updated_at,
        })
    }

    pub fn get_tags_for_card(conn: &Connection, card_id: &str) -> AppResult<Vec<String>> {
        let mut stmt = conn.prepare(
            "SELECT t.name FROM tags t 
             JOIN card_tags ct ON t.id = ct.tag_id 
             WHERE ct.card_id = ?1 ORDER BY t.name ASC",
        )?;
        let rows = stmt.query_map(params![card_id], |r| r.get::<_, String>(0))?;
        let mut tags = Vec::new();
        for r in rows {
            tags.push(r?);
        }
        Ok(tags)
    }

    pub fn set_tags_for_card(conn: &Connection, card_id: &str, tag_names: &[String]) -> AppResult<()> {
        conn.execute("DELETE FROM card_tags WHERE card_id = ?1", params![card_id])?;

        for name in tag_names {
            let clean_name = name.trim().to_lowercase();
            if clean_name.is_empty() {
                continue;
            }

            // Find or create tag
            let tag_id: String = match conn.query_row(
                "SELECT id FROM tags WHERE name = ?1",
                params![clean_name],
                |r| r.get(0),
            ) {
                Ok(id) => id,
                Err(_) => {
                    let new_id = format!("tag-{}", Uuid::new_v4());
                    let now = Utc::now().to_rfc3339();
                    conn.execute(
                        "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
                        params![new_id, clean_name, "#64748b", now],
                    )?;
                    new_id
                }
            };

            conn.execute(
                "INSERT OR IGNORE INTO card_tags (card_id, tag_id) VALUES (?1, ?2)",
                params![card_id, tag_id],
            )?;
        }

        Ok(())
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<Card> {
        let card = conn.query_row(
            "SELECT id, deck_id, card_type, front, back, notes, state, stability, difficulty, reps, lapses, review_count, last_review, next_review, interval_days, ease_factor, suspended, buried, created_at, updated_at 
             FROM cards WHERE id = ?1",
            params![id],
            |row| Self::row_to_card(conn, row),
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Card {} not found", id)),
            _ => AppError::Database(e),
        })?;
        Ok(card)
    }

    pub fn create(conn: &Connection, dto: CreateCardDto) -> AppResult<Card> {
        let id = format!("card-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO cards (
                id, deck_id, card_type, front, back, notes, state, stability, difficulty, 
                reps, lapses, review_count, last_review, next_review, interval_days, ease_factor, 
                suspended, buried, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, 'new', 0.0, 0.0, 
                0, 0, 0, NULL, ?7, 0.0, 2.5, 
                0, 0, ?8, ?9
            )",
            params![
                id,
                dto.deck_id,
                dto.card_type.as_str(),
                dto.front,
                dto.back,
                dto.notes,
                now,
                now,
                now
            ],
        )?;

        Self::set_tags_for_card(conn, &id, &dto.tags)?;
        Self::get_by_id(conn, &id)
    }

    pub fn update(conn: &Connection, dto: UpdateCardDto) -> AppResult<Card> {
        let existing = Self::get_by_id(conn, &dto.id)?;
        let now = Utc::now().to_rfc3339();

        let deck_id = dto.deck_id.unwrap_or(existing.deck_id);
        let card_type = dto.card_type.unwrap_or(existing.card_type);
        let front = dto.front.unwrap_or(existing.front);
        let back = dto.back.unwrap_or(existing.back);
        let notes = match dto.notes {
            Some(n) => Some(n),
            None => existing.notes,
        };
        let suspended = dto.suspended.unwrap_or(existing.suspended);
        let buried = dto.buried.unwrap_or(existing.buried);

        conn.execute(
            "UPDATE cards SET 
                deck_id = ?1, card_type = ?2, front = ?3, back = ?4, notes = ?5, 
                suspended = ?6, buried = ?7, updated_at = ?8
             WHERE id = ?9",
            params![
                deck_id,
                card_type.as_str(),
                front,
                back,
                notes,
                if suspended { 1 } else { 0 },
                if buried { 1 } else { 0 },
                now,
                dto.id
            ],
        )?;

        if let Some(tags) = dto.tags {
            Self::set_tags_for_card(conn, &dto.id, &tags)?;
        }

        Self::get_by_id(conn, &dto.id)
    }

    pub fn update_card_fsrs(conn: &Connection, card: &Card) -> AppResult<()> {
        let now = Utc::now().to_rfc3339();
        let last_rev_str = card.last_review.map(|dt| dt.to_rfc3339());
        let next_rev_str = card.next_review.map(|dt| dt.to_rfc3339());

        conn.execute(
            "UPDATE cards SET 
                state = ?1, stability = ?2, difficulty = ?3, reps = ?4, lapses = ?5, 
                review_count = ?6, last_review = ?7, next_review = ?8, interval_days = ?9, 
                suspended = ?10, buried = ?11, updated_at = ?12
             WHERE id = ?13",
            params![
                card.state.as_str(),
                card.stability,
                card.difficulty,
                card.reps,
                card.lapses,
                card.review_count,
                last_rev_str,
                next_rev_str,
                card.interval_days,
                if card.suspended { 1 } else { 0 },
                if card.buried { 1 } else { 0 },
                now,
                card.id
            ],
        )?;

        Ok(())
    }

    pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
        conn.execute("DELETE FROM cards WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn toggle_suspend(conn: &Connection, id: &str) -> AppResult<bool> {
        let card = Self::get_by_id(conn, id)?;
        let new_state = !card.suspended;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE cards SET suspended = ?1, updated_at = ?2 WHERE id = ?3",
            params![if new_state { 1 } else { 0 }, now, id],
        )?;
        Ok(new_state)
    }

    pub fn get_by_deck(conn: &Connection, deck_id: &str) -> AppResult<Vec<Card>> {
        let mut stmt = conn.prepare(
            "SELECT id, deck_id, card_type, front, back, notes, state, stability, difficulty, reps, lapses, review_count, last_review, next_review, interval_days, ease_factor, suspended, buried, created_at, updated_at 
             FROM cards 
             WHERE deck_id = ?1 
             ORDER BY created_at ASC",
        )?;

        let rows = stmt.query_map(params![deck_id], |row| Self::row_to_card(conn, row))?;
        let mut cards = Vec::new();
        for r in rows {
            cards.push(r?);
        }
        Ok(cards)
    }

    pub fn get_due_cards_for_deck(conn: &Connection, deck_id: &str, limit: u32) -> AppResult<Vec<Card>> {
        let now = Utc::now().to_rfc3339();
        let mut stmt = conn.prepare(
            "SELECT id, deck_id, card_type, front, back, notes, state, stability, difficulty, reps, lapses, review_count, last_review, next_review, interval_days, ease_factor, suspended, buried, created_at, updated_at 
             FROM cards 
             WHERE deck_id = ?1 
               AND suspended = 0 
               AND buried = 0
               AND (state = 'new' OR next_review <= ?2)
             ORDER BY 
               CASE state 
                 WHEN 'relearning' THEN 1 
                 WHEN 'learning' THEN 2 
                 WHEN 'review' THEN 3 
                 WHEN 'new' THEN 4 
                 ELSE 5 
               END ASC,
               next_review ASC
             LIMIT ?3",
        )?;

        let rows = stmt.query_map(params![deck_id, now, limit], |row| Self::row_to_card(conn, row))?;
        let mut cards = Vec::new();
        for r in rows {
            cards.push(r?);
        }
        Ok(cards)
    }

    pub fn get_all_due_cards(conn: &Connection, limit: u32) -> AppResult<Vec<Card>> {
        let now = Utc::now().to_rfc3339();
        let mut stmt = conn.prepare(
            "SELECT id, deck_id, card_type, front, back, notes, state, stability, difficulty, reps, lapses, review_count, last_review, next_review, interval_days, ease_factor, suspended, buried, created_at, updated_at 
             FROM cards 
             WHERE suspended = 0 
               AND buried = 0
               AND (state = 'new' OR next_review <= ?1)
             ORDER BY 
               CASE state 
                 WHEN 'relearning' THEN 1 
                 WHEN 'learning' THEN 2 
                 WHEN 'review' THEN 3 
                 WHEN 'new' THEN 4 
                 ELSE 5 
               END ASC,
               next_review ASC
             LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![now, limit], |row| Self::row_to_card(conn, row))?;
        let mut cards = Vec::new();
        for r in rows {
            cards.push(r?);
        }
        Ok(cards)
    }

    pub fn get_weak_cards(conn: &Connection, limit: u32) -> AppResult<Vec<WeakCardInfo>> {
        let mut stmt = conn.prepare(
            "SELECT 
                c.id, d.name as deck_name, c.front, c.lapses, c.review_count, c.difficulty, c.stability
             FROM cards c
             JOIN decks d ON c.deck_id = d.id
             WHERE c.lapses > 0 OR c.difficulty >= 6.5
             ORDER BY c.lapses DESC, c.difficulty DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit], |r| {
            let lapses: u32 = r.get("lapses")?;
            let review_count: u32 = r.get("review_count")?;
            let difficulty: f64 = r.get("difficulty")?;
            let stability: f64 = r.get("stability")?;

            let failure_rate = if review_count > 0 {
                (lapses as f64 / review_count as f64) * 100.0
            } else {
                0.0
            };

            let retention_estimate = if stability > 0.0 {
                (1.0 + 1.0 / (9.0 * stability)).recip() * 100.0
            } else {
                50.0
            };

            Ok(WeakCardInfo {
                card_id: r.get("id")?,
                deck_name: r.get("deck_name")?,
                front: r.get("front")?,
                lapses,
                failure_rate: (failure_rate * 10.0).round() / 10.0,
                difficulty: (difficulty * 10.0).round() / 10.0,
                retention_estimate: (retention_estimate * 10.0).round() / 10.0,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn search(
        conn: &Connection,
        query: &str,
        deck_id: Option<&str>,
        tag: Option<&str>,
        state: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> AppResult<Vec<CardWithDeckInfo>> {
        let mut sql = String::from(
            "SELECT 
                c.id, c.deck_id, c.card_type, c.front, c.back, c.notes, c.state, 
                c.stability, c.difficulty, c.reps, c.lapses, c.review_count, 
                c.last_review, c.next_review, c.interval_days, c.ease_factor, 
                c.suspended, c.buried, c.created_at, c.updated_at,
                d.name as deck_name, d.color as deck_color
             FROM cards c
             JOIN decks d ON c.deck_id = d.id
             LEFT JOIN card_tags ct ON c.id = ct.card_id
             LEFT JOIN tags t ON ct.tag_id = t.id
             WHERE 1=1 "
        );

        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if !query.trim().is_empty() {
            let pattern = format!("%{}%", query.trim());
            sql.push_str(" AND (c.front LIKE ? OR c.back LIKE ? OR c.notes LIKE ?) ");
            params_vec.push(Box::new(pattern.clone()));
            params_vec.push(Box::new(pattern.clone()));
            params_vec.push(Box::new(pattern));
        }

        if let Some(did) = deck_id {
            if !did.is_empty() {
                sql.push_str(" AND c.deck_id = ? ");
                params_vec.push(Box::new(did.to_string()));
            }
        }

        if let Some(t) = tag {
            if !t.is_empty() {
                sql.push_str(" AND t.name = ? ");
                params_vec.push(Box::new(t.to_lowercase()));
            }
        }

        if let Some(st) = state {
            if !st.is_empty() {
                sql.push_str(" AND c.state = ? ");
                params_vec.push(Box::new(st.to_string()));
            }
        }

        sql.push_str(" GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?");
        params_vec.push(Box::new(limit));
        params_vec.push(Box::new(offset));

        let mut stmt = conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            let card = Self::row_to_card(conn, row)?;
            let deck_name: String = row.get("deck_name")?;
            let deck_color: Option<String> = row.get("deck_color")?;

            Ok(CardWithDeckInfo {
                card,
                deck_name,
                deck_color,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }
}
