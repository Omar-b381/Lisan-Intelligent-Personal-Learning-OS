use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::domain::media::MediaItem;
use crate::errors::{AppError, AppResult};

pub struct MediaRepository;

impl MediaRepository {
    pub fn row_to_media(row: &Row) -> rusqlite::Result<MediaItem> {
        let created_str: String = row.get("created_at")?;
        let created_at = DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        Ok(MediaItem {
            id: row.get("id")?,
            filename: row.get("filename")?,
            original_name: row.get("original_name")?,
            mime_type: row.get("mime_type")?,
            file_size: row.get::<_, i64>("file_size")? as u64,
            hash: row.get("hash")?,
            created_at,
        })
    }

    pub fn insert(
        conn: &Connection,
        filename: &str,
        original_name: &str,
        mime_type: &str,
        file_size: u64,
        hash: &str,
    ) -> AppResult<MediaItem> {
        let id = format!("media-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO media (id, filename, original_name, mime_type, file_size, hash, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, filename, original_name, mime_type, file_size as i64, hash, now],
        )?;

        let item = conn.query_row(
            "SELECT id, filename, original_name, mime_type, file_size, hash, created_at FROM media WHERE id = ?1",
            params![id],
            |r| Self::row_to_media(r),
        )?;

        Ok(item)
    }

    pub fn get_by_hash(conn: &Connection, hash: &str) -> AppResult<Option<MediaItem>> {
        let res = conn.query_row(
            "SELECT id, filename, original_name, mime_type, file_size, hash, created_at FROM media WHERE hash = ?1",
            params![hash],
            |r| Self::row_to_media(r),
        );

        match res {
            Ok(item) => Ok(Some(item)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e)),
        }
    }

    pub fn link_to_card(conn: &Connection, card_id: &str, media_id: &str) -> AppResult<()> {
        conn.execute(
            "INSERT OR IGNORE INTO card_media (card_id, media_id) VALUES (?1, ?2)",
            params![card_id, media_id],
        )?;
        Ok(())
    }
}
