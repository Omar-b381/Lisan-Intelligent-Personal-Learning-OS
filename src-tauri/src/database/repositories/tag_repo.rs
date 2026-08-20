use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::domain::tag::{Tag, TagStats};
use crate::errors::AppResult;

pub struct TagRepository;

impl TagRepository {
    pub fn row_to_tag(row: &Row) -> rusqlite::Result<Tag> {
        let created_str: String = row.get("created_at")?;
        let created_at = DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        Ok(Tag {
            id: row.get("id")?,
            name: row.get("name")?,
            color: row.get("color")?,
            created_at,
        })
    }

    pub fn get_all(conn: &Connection) -> AppResult<Vec<TagStats>> {
        let mut stmt = conn.prepare(
            "SELECT 
                t.id, t.name, t.color,
                COUNT(ct.card_id) as card_count,
                COALESCE(SUM(CASE WHEN r.rating >= 3 THEN 1 ELSE 0 END), 0) as success_revs,
                COUNT(r.id) as total_revs
             FROM tags t
             LEFT JOIN card_tags ct ON t.id = ct.tag_id
             LEFT JOIN cards c ON ct.card_id = c.id
             LEFT JOIN reviews r ON c.id = r.card_id
             GROUP BY t.id
             ORDER BY card_count DESC, t.name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            let success_revs: i64 = row.get("success_revs")?;
            let total_revs: i64 = row.get("total_revs")?;

            let retention_rate = if total_revs > 0 {
                (success_revs as f64 / total_revs as f64) * 100.0
            } else {
                100.0
            };

            Ok(TagStats {
                id: row.get("id")?,
                name: row.get("name")?,
                color: row.get("color")?,
                card_count: row.get("card_count")?,
                retention_rate: (retention_rate * 10.0).round() / 10.0,
            })
        })?;

        let mut list = Vec::new();
        for r in rows {
            list.push(r?);
        }
        Ok(list)
    }

    pub fn create_or_get(conn: &Connection, name: &str, color: Option<&str>) -> AppResult<Tag> {
        let clean = name.trim().to_lowercase();
        let color_val = color.unwrap_or("#64748b");

        let existing = conn.query_row(
            "SELECT id, name, color, created_at FROM tags WHERE name = ?1",
            params![clean],
            |r| Self::row_to_tag(r),
        );

        if let Ok(tag) = existing {
            return Ok(tag);
        }

        let id = format!("tag-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, clean, color_val, now],
        )?;

        let tag = conn.query_row(
            "SELECT id, name, color, created_at FROM tags WHERE id = ?1",
            params![id],
            |r| Self::row_to_tag(r),
        )?;

        Ok(tag)
    }

    pub fn rename(conn: &Connection, id: &str, new_name: &str) -> AppResult<()> {
        let clean = new_name.trim().to_lowercase();
        conn.execute(
            "UPDATE tags SET name = ?1 WHERE id = ?2",
            params![clean, id],
        )?;
        Ok(())
    }

    pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
        conn.execute("DELETE FROM tags WHERE id = ?1", params![id])?;
        Ok(())
    }
}
