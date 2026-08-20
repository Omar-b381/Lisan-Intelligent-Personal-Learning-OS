use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::domain::pomodoro::{PomodoroConfig, PomodoroMode, PomodoroSession, PomodoroSessionSummary};
use crate::errors::{AppError, AppResult};

pub struct PomodoroRepository;

impl PomodoroRepository {
    pub fn row_to_pomodoro(row: &Row) -> rusqlite::Result<PomodoroSession> {
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

        let mode_str: String = row.get("mode")?;
        let mode = match mode_str.as_str() {
            "short_break" => PomodoroMode::ShortBreak,
            "long_break" => PomodoroMode::LongBreak,
            _ => PomodoroMode::Focus,
        };

        let completed_int: i32 = row.get("completed")?;

        Ok(PomodoroSession {
            id: row.get("id")?,
            mode,
            target_duration_secs: row.get("target_duration_secs")?,
            actual_duration_secs: row.get("actual_duration_secs")?,
            completed: completed_int != 0,
            started_at,
            ended_at,
        })
    }

    pub fn start(conn: &Connection, mode: PomodoroMode, target_duration_secs: u32) -> AppResult<PomodoroSession> {
        let id = format!("pomo-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let mode_str = match mode {
            PomodoroMode::Focus => "focus",
            PomodoroMode::ShortBreak => "short_break",
            PomodoroMode::LongBreak => "long_break",
        };

        conn.execute(
            "INSERT INTO pomodoro_sessions (id, mode, target_duration_secs, actual_duration_secs, completed, started_at, ended_at)
             VALUES (?1, ?2, ?3, 0, 0, ?4, NULL)",
            params![id, mode_str, target_duration_secs, now],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn complete(conn: &Connection, id: &str, actual_duration_secs: u32) -> AppResult<PomodoroSessionSummary> {
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE pomodoro_sessions SET completed = 1, actual_duration_secs = ?1, ended_at = ?2 WHERE id = ?3",
            params![actual_duration_secs, now, id],
        )?;

        // Aggregate study activity tied to this pomodoro session
        let (reviewed, correct, incorrect, xp): (u32, u32, u32, u32) = conn.query_row(
            "SELECT 
                COALESCE(SUM(cards_reviewed), 0),
                COALESCE(SUM(cards_correct), 0),
                COALESCE(SUM(cards_incorrect), 0),
                COALESCE(SUM(xp_earned), 0)
             FROM study_sessions WHERE pomodoro_id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        ).unwrap_or((0, 0, 0, 0));

        let success_rate = if reviewed > 0 {
            (correct as f64 / reviewed as f64) * 100.0
        } else {
            100.0
        };

        let pomo_xp_bonus = 50;

        Ok(PomodoroSessionSummary {
            session_id: id.to_string(),
            focus_minutes: (actual_duration_secs / 60),
            cards_reviewed: reviewed,
            cards_correct: correct,
            cards_incorrect: incorrect,
            success_rate: (success_rate * 10.0).round() / 10.0,
            xp_earned: xp + pomo_xp_bonus,
        })
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<PomodoroSession> {
        let session = conn.query_row(
            "SELECT id, mode, target_duration_secs, actual_duration_secs, completed, started_at, ended_at 
             FROM pomodoro_sessions WHERE id = ?1",
            params![id],
            |row| Self::row_to_pomodoro(row),
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Pomodoro session {} not found", id)),
            _ => AppError::Database(e),
        })?;
        Ok(session)
    }

    pub fn get_config(conn: &Connection) -> AppResult<PomodoroConfig> {
        let config_str: Option<String> = conn.query_row(
            "SELECT value FROM settings WHERE key = 'pomodoro_config'",
            [],
            |r| r.get(0),
        ).ok();

        if let Some(s) = config_str {
            if let Ok(cfg) = serde_json::from_str::<PomodoroConfig>(&s) {
                return Ok(cfg);
            }
        }

        Ok(PomodoroConfig::default())
    }

    pub fn save_config(conn: &Connection, config: &PomodoroConfig) -> AppResult<()> {
        let json_str = serde_json::to_string(config)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES ('pomodoro_config', ?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2",
            params![json_str, now],
        )?;

        Ok(())
    }
}
