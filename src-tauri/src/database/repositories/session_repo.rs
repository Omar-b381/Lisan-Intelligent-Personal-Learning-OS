use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::domain::session::{DailyStudyPlan, StudySession};
use crate::errors::{AppError, AppResult};

pub struct SessionRepository;

impl SessionRepository {
    pub fn row_to_session(row: &Row) -> rusqlite::Result<StudySession> {
        let started_str: String = row.get("started_at")?;
        let ended_str: Option<String> = row.get("ended_at")?;

        let started_at = DateTime::parse_from_rfc3339(&started_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let ended_at = ended_str.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        });

        Ok(StudySession {
            id: row.get("id")?,
            deck_id: row.get("deck_id")?,
            pomodoro_id: row.get("pomodoro_id")?,
            started_at,
            ended_at,
            cards_reviewed: row.get("cards_reviewed")?,
            cards_correct: row.get("cards_correct")?,
            cards_incorrect: row.get("cards_incorrect")?,
            xp_earned: row.get("xp_earned")?,
        })
    }

    pub fn start_session(conn: &Connection, deck_id: Option<String>, pomodoro_id: Option<String>) -> AppResult<StudySession> {
        let id = format!("session-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO study_sessions (id, deck_id, pomodoro_id, started_at, ended_at, cards_reviewed, cards_correct, cards_incorrect, xp_earned)
             VALUES (?1, ?2, ?3, ?4, NULL, 0, 0, 0, 0)",
            params![id, deck_id, pomodoro_id, now],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<StudySession> {
        let session = conn.query_row(
            "SELECT id, deck_id, pomodoro_id, started_at, ended_at, cards_reviewed, cards_correct, cards_incorrect, xp_earned 
             FROM study_sessions WHERE id = ?1",
            params![id],
            |row| Self::row_to_session(row),
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Study session {} not found", id)),
            _ => AppError::Database(e),
        })?;
        Ok(session)
    }

    pub fn record_session_card(conn: &Connection, session_id: &str, is_correct: bool, xp: u32) -> AppResult<()> {
        let (correct_inc, incorrect_inc) = if is_correct { (1, 0) } else { (0, 1) };
        conn.execute(
            "UPDATE study_sessions SET 
                cards_reviewed = cards_reviewed + 1,
                cards_correct = cards_correct + ?1,
                cards_incorrect = cards_incorrect + ?2,
                xp_earned = xp_earned + ?3
             WHERE id = ?4",
            params![correct_inc, incorrect_inc, xp, session_id],
        )?;
        Ok(())
    }

    pub fn end_session(conn: &Connection, session_id: &str) -> AppResult<StudySession> {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE study_sessions SET ended_at = ?1 WHERE id = ?2",
            params![now, session_id],
        )?;
        Self::get_by_id(conn, session_id)
    }

    pub fn get_daily_plan(conn: &Connection) -> AppResult<DailyStudyPlan> {
        let now = Utc::now().to_rfc3339();

        let due_reviews: u32 = conn.query_row(
            "SELECT COUNT(1) FROM cards WHERE state IN ('learning', 'review', 'relearning') AND next_review <= ?1 AND suspended = 0 AND buried = 0",
            params![now],
            |r| r.get(0),
        ).unwrap_or(0);

        let new_cards: u32 = conn.query_row(
            "SELECT COUNT(1) FROM cards WHERE state = 'new' AND suspended = 0 AND buried = 0",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let weak_cards: u32 = conn.query_row(
            "SELECT COUNT(1) FROM cards WHERE lapses >= 2 AND suspended = 0",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let today_reviewed: u32 = conn.query_row(
            "SELECT COUNT(1) FROM reviews WHERE date(reviewed_at) = date('now')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let today_study_ms: i64 = conn.query_row(
            "SELECT COALESCE(SUM(response_time_ms), 0) FROM reviews WHERE date(reviewed_at) = date('now')",
            [],
            |r| r.get(0),
        ).unwrap_or(0);

        let today_study_time_minutes = (today_study_ms / 60000) as u32;

        let total_due_today = due_reviews + new_cards.min(20);
        // Estimate approx 45 seconds per card
        let estimated_study_time_minutes = ((total_due_today as f64 * 45.0) / 60.0).ceil() as u32;
        let recommended_pomodoros = (estimated_study_time_minutes as f64 / 25.0).ceil().max(1.0) as u32;

        let current_streak_days = Self::calculate_streak(conn)?;

        Ok(DailyStudyPlan {
            due_reviews_count: due_reviews,
            new_cards_count: new_cards,
            weak_cards_count: weak_cards,
            total_due_today,
            estimated_study_time_minutes,
            recommended_pomodoros,
            current_streak_days,
            today_cards_reviewed: today_reviewed,
            today_study_time_minutes,
            target_daily_reviews: 50,
        })
    }

    pub fn calculate_streak(conn: &Connection) -> AppResult<u32> {
        let mut stmt = conn.prepare(
            "SELECT DISTINCT date(reviewed_at) as rev_date 
             FROM reviews 
             ORDER BY rev_date DESC 
             LIMIT 100",
        )?;

        let dates: Vec<String> = stmt
            .query_map([], |r| r.get(0))?
            .filter_map(|res| res.ok())
            .collect();

        if dates.is_empty() {
            return Ok(0);
        }

        let mut streak = 0;
        let mut expected = chrono::Local::now().date_naive();

        for date_str in dates {
            if let Ok(parsed) = chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
                if parsed == expected {
                    streak += 1;
                    expected = expected.pred_opt().unwrap_or(expected);
                } else if streak == 0 && parsed == expected.pred_opt().unwrap_or(expected) {
                    // Studied yesterday, still in streak
                    streak += 1;
                    expected = parsed.pred_opt().unwrap_or(parsed);
                } else {
                    break;
                }
            }
        }

        Ok(streak)
    }
}
