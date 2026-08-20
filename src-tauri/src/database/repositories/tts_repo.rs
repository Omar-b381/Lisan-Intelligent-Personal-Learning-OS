use chrono::Utc;
use rusqlite::{params, Connection, Row};

use crate::errors::AppResult;
use crate::tts::models::{TtsAudioRecord, TtsCacheStats};

pub struct TtsRepository;

impl TtsRepository {
    pub fn get_by_hash(conn: &Connection, text_hash: &str) -> AppResult<Option<TtsAudioRecord>> {
        let mut stmt = conn.prepare(
            "SELECT id, text_hash, text, language, provider, voice, speed, pitch,
                    file_path, mime_type, file_size, duration_ms, play_count, last_used_at, created_at
             FROM tts_audio
             WHERE text_hash = ?1",
        )?;

        let mut rows = stmt.query(params![text_hash])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Self::row_to_record(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn insert(conn: &Connection, record: &TtsAudioRecord) -> AppResult<()> {
        conn.execute(
            "INSERT INTO tts_audio (
                id, text_hash, text, language, provider, voice, speed, pitch,
                file_path, mime_type, file_size, duration_ms, play_count, last_used_at, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            ON CONFLICT(text_hash) DO UPDATE SET
                last_used_at = excluded.last_used_at,
                play_count = tts_audio.play_count + 1",
            params![
                record.id,
                record.text_hash,
                record.text,
                record.language,
                record.provider,
                record.voice,
                record.speed,
                record.pitch,
                record.file_path,
                record.mime_type,
                record.file_size as i64,
                record.duration_ms as i64,
                record.play_count as i64,
                record.last_used_at,
                record.created_at,
            ],
        )?;

        Ok(())
    }

    pub fn increment_play_count(conn: &Connection, text_hash: &str) -> AppResult<()> {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE tts_audio
             SET play_count = play_count + 1, last_used_at = ?1
             WHERE text_hash = ?2",
            params![now, text_hash],
        )?;
        Ok(())
    }

    pub fn get_stats(conn: &Connection) -> AppResult<TtsCacheStats> {
        let (total_files, total_size, total_plays): (i64, i64, i64) = conn.query_row(
            "SELECT COUNT(1), COALESCE(SUM(file_size), 0), COALESCE(SUM(play_count), 0) FROM tts_audio",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;

        Ok(TtsCacheStats {
            total_files: total_files as usize,
            total_size_bytes: total_size as u64,
            total_plays: total_plays as u64,
        })
    }

    pub fn delete_all(conn: &Connection) -> AppResult<Vec<String>> {
        let mut stmt = conn.prepare("SELECT file_path FROM tts_audio")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        let mut paths = Vec::new();
        for path in rows {
            paths.push(path?);
        }

        conn.execute("DELETE FROM tts_audio", [])?;
        Ok(paths)
    }

    pub fn delete_unused(conn: &Connection) -> AppResult<Vec<String>> {
        // Find audio not directly referenced in cards.audio_file and play_count <= 1
        let mut stmt = conn.prepare(
            "SELECT file_path FROM tts_audio
             WHERE play_count <= 1 AND file_path NOT IN (
                 SELECT COALESCE(audio_file, '') FROM cards WHERE audio_file IS NOT NULL
             )",
        )?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        let mut paths = Vec::new();
        for path in rows {
            paths.push(path?);
        }

        conn.execute(
            "DELETE FROM tts_audio
             WHERE play_count <= 1 AND file_path NOT IN (
                 SELECT COALESCE(audio_file, '') FROM cards WHERE audio_file IS NOT NULL
             )",
            [],
        )?;

        Ok(paths)
    }

    pub fn get_provider_credentials(conn: &Connection, provider: &str) -> AppResult<Option<String>> {
        let key = format!("tts_apikey_{}", provider);
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            let val: String = row.get(0)?;
            Ok(Some(val))
        } else {
            Ok(None)
        }
    }

    pub fn save_provider_credentials(conn: &Connection, provider: &str, api_key: &str) -> AppResult<()> {
        let key = format!("tts_apikey_{}", provider);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, api_key, now],
        )?;
        Ok(())
    }

    fn row_to_record(row: &Row) -> rusqlite::Result<TtsAudioRecord> {
        Ok(TtsAudioRecord {
            id: row.get(0)?,
            text_hash: row.get(1)?,
            text: row.get(2)?,
            language: row.get(3)?,
            provider: row.get(4)?,
            voice: row.get(5)?,
            speed: row.get(6)?,
            pitch: row.get(7)?,
            file_path: row.get(8)?,
            mime_type: row.get(9)?,
            file_size: row.get::<_, i64>(10)? as u64,
            duration_ms: row.get::<_, i64>(11)? as u32,
            play_count: row.get::<_, i64>(12)? as u64,
            last_used_at: row.get(13)?,
            created_at: row.get(14)?,
        })
    }
}
