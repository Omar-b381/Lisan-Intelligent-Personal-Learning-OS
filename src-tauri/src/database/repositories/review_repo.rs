use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Row};

use crate::domain::card::{CardState, Rating};
use crate::domain::review::ReviewLog;
use crate::errors::AppResult;

pub struct ReviewRepository;

impl ReviewRepository {
    pub fn row_to_review(row: &Row) -> rusqlite::Result<ReviewLog> {
        let reviewed_str: String = row.get("reviewed_at")?;
        let reviewed_at = DateTime::parse_from_rfc3339(&reviewed_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let rating_int: u8 = row.get("rating")?;
        let state_str: String = row.get("review_state")?;

        Ok(ReviewLog {
            id: row.get("id")?,
            card_id: row.get("card_id")?,
            session_id: row.get("session_id")?,
            rating: Rating::from_u8(rating_int),
            review_state: CardState::from_str(&state_str),
            scheduled_days: row.get("scheduled_days")?,
            elapsed_days: row.get("elapsed_days")?,
            last_stability: row.get("last_stability")?,
            new_stability: row.get("new_stability")?,
            last_difficulty: row.get("last_difficulty")?,
            new_difficulty: row.get("new_difficulty")?,
            response_time_ms: row.get("response_time_ms")?,
            reviewed_at,
        })
    }

    pub fn insert(conn: &Connection, log: &ReviewLog) -> AppResult<()> {
        conn.execute(
            "INSERT INTO reviews (
                id, card_id, session_id, rating, review_state, scheduled_days, elapsed_days,
                last_stability, new_stability, last_difficulty, new_difficulty, response_time_ms, reviewed_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
            )",
            params![
                log.id,
                log.card_id,
                log.session_id,
                log.rating.as_u8(),
                log.review_state.as_str(),
                log.scheduled_days,
                log.elapsed_days,
                log.last_stability,
                log.new_stability,
                log.last_difficulty,
                log.new_difficulty,
                log.response_time_ms,
                log.reviewed_at.to_rfc3339()
            ],
        )?;
        Ok(())
    }

    pub fn get_by_card(conn: &Connection, card_id: &str) -> AppResult<Vec<ReviewLog>> {
        let mut stmt = conn.prepare(
            "SELECT id, card_id, session_id, rating, review_state, scheduled_days, elapsed_days,
                    last_stability, new_stability, last_difficulty, new_difficulty, response_time_ms, reviewed_at
             FROM reviews WHERE card_id = ?1 ORDER BY reviewed_at DESC",
        )?;

        let rows = stmt.query_map(params![card_id], |r| Self::row_to_review(r))?;
        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn get_today_count(conn: &Connection) -> AppResult<u32> {
        let count: u32 = conn.query_row(
            "SELECT COUNT(1) FROM reviews WHERE date(reviewed_at) = date('now')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);
        Ok(count)
    }
}
