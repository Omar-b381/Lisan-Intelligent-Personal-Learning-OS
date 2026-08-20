use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::domain::deck::{CreateDeckDto, Deck, DeckStats, DeckWithStats, UpdateDeckDto};
use crate::errors::{AppError, AppResult};

pub struct DeckRepository;

impl DeckRepository {
    pub fn row_to_deck(row: &Row) -> rusqlite::Result<Deck> {
        let created_str: String = row.get("created_at")?;
        let updated_str: String = row.get("updated_at")?;

        let created_at = DateTime::parse_from_rfc3339(&created_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let updated_at = DateTime::parse_from_rfc3339(&updated_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        Ok(Deck {
            id: row.get("id")?,
            parent_id: row.get("parent_id")?,
            name: row.get("name")?,
            description: row.get("description")?,
            color: row.get("color")?,
            icon: row.get("icon")?,
            priority: row.get("priority")?,
            created_at,
            updated_at,
        })
    }

    pub fn get_all(conn: &Connection) -> AppResult<Vec<Deck>> {
        let mut stmt = conn.prepare(
            "SELECT id, parent_id, name, description, color, icon, priority, created_at, updated_at 
             FROM decks ORDER BY priority DESC, name ASC",
        )?;

        let rows = stmt.query_map([], |row| Self::row_to_deck(row))?;
        let mut decks = Vec::new();
        for r in rows {
            decks.push(r?);
        }
        Ok(decks)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<Deck> {
        let deck = conn.query_row(
            "SELECT id, parent_id, name, description, color, icon, priority, created_at, updated_at 
             FROM decks WHERE id = ?1",
            params![id],
            |row| Self::row_to_deck(row),
        ).map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(format!("Deck {} not found", id)),
            _ => AppError::Database(e),
        })?;
        Ok(deck)
    }

    pub fn create(conn: &Connection, dto: CreateDeckDto) -> AppResult<Deck> {
        let id = format!("deck-{}", Uuid::new_v4());
        let now = Utc::now().to_rfc3339();
        let color = dto.color.unwrap_or_else(|| "#3b82f6".to_string());
        let icon = dto.icon.unwrap_or_else(|| "folder".to_string());
        let priority = dto.priority.unwrap_or(0);

        conn.execute(
            "INSERT INTO decks (id, parent_id, name, description, color, icon, priority, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                dto.parent_id,
                dto.name,
                dto.description,
                color,
                icon,
                priority,
                now,
                now
            ],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn update(conn: &Connection, dto: UpdateDeckDto) -> AppResult<Deck> {
        let existing = Self::get_by_id(conn, &dto.id)?;
        let now = Utc::now().to_rfc3339();

        let parent_id = match dto.parent_id {
            Some(p) => p,
            None => existing.parent_id,
        };
        let name = dto.name.unwrap_or(existing.name);
        let description = match dto.description {
            Some(d) => Some(d),
            None => existing.description,
        };
        let color = dto.color.unwrap_or(existing.color);
        let icon = dto.icon.unwrap_or(existing.icon);
        let priority = dto.priority.unwrap_or(existing.priority);

        conn.execute(
            "UPDATE decks SET parent_id = ?1, name = ?2, description = ?3, color = ?4, icon = ?5, priority = ?6, updated_at = ?7
             WHERE id = ?8",
            params![parent_id, name, description, color, icon, priority, now, dto.id],
        )?;

        Self::get_by_id(conn, &dto.id)
    }

    pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
        conn.execute("DELETE FROM decks WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_deck_stats(conn: &Connection, deck_id: &str) -> AppResult<DeckStats> {
        let now = Utc::now().to_rfc3339();
        
        let total_cards: u32 = conn.query_row(
            "SELECT COUNT(1) FROM cards WHERE deck_id = ?1",
            params![deck_id],
            |r| r.get(0),
        ).unwrap_or(0);

        let new_cards: u32 = conn.query_row(
            "SELECT COUNT(1) FROM cards WHERE deck_id = ?1 AND state = 'new' AND suspended = 0 AND buried = 0",
            params![deck_id],
            |r| r.get(0),
        ).unwrap_or(0);

        let learning_cards: u32 = conn.query_row(
            "SELECT COUNT(1) FROM cards WHERE deck_id = ?1 AND state IN ('learning', 'relearning') AND suspended = 0 AND buried = 0",
            params![deck_id],
            |r| r.get(0),
        ).unwrap_or(0);

        let due_cards: u32 = conn.query_row(
            "SELECT COUNT(1) FROM cards WHERE deck_id = ?1 AND (state = 'new' OR (next_review <= ?2 AND state IN ('learning', 'review', 'relearning'))) AND suspended = 0 AND buried = 0",
            params![deck_id, now],
            |r| r.get(0),
        ).unwrap_or(0);

        let suspended_cards: u32 = conn.query_row(
            "SELECT COUNT(1) FROM cards WHERE deck_id = ?1 AND suspended = 1",
            params![deck_id],
            |r| r.get(0),
        ).unwrap_or(0);

        let today_reviews: u32 = conn.query_row(
            "SELECT COUNT(1) FROM reviews r JOIN cards c ON r.card_id = c.id WHERE c.deck_id = ?1 AND date(r.reviewed_at) = date('now')",
            params![deck_id],
            |r| r.get(0),
        ).unwrap_or(0);

        // Retention rate = successful reviews / total reviews (where rating >= 2 or 3)
        let (successful_reviews, total_reviews): (i64, i64) = conn.query_row(
            "SELECT 
                COALESCE(SUM(CASE WHEN r.rating >= 3 THEN 1 ELSE 0 END), 0),
                COUNT(r.id)
             FROM reviews r JOIN cards c ON r.card_id = c.id WHERE c.deck_id = ?1",
            params![deck_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap_or((0, 0));

        let retention_rate = if total_reviews > 0 {
            (successful_reviews as f64 / total_reviews as f64) * 100.0
        } else {
            100.0
        };

        // Total study time from reviews (in minutes)
        let total_ms: i64 = conn.query_row(
            "SELECT COALESCE(SUM(r.response_time_ms), 0) FROM reviews r JOIN cards c ON r.card_id = c.id WHERE c.deck_id = ?1",
            params![deck_id],
            |r| r.get(0),
        ).unwrap_or(0);

        let study_time_minutes = (total_ms / 60000) as u32;

        Ok(DeckStats {
            total_cards,
            new_cards,
            learning_cards,
            due_cards,
            suspended_cards,
            today_reviews,
            retention_rate: (retention_rate * 10.0).round() / 10.0,
            study_time_minutes,
        })
    }

    pub fn get_tree(conn: &Connection) -> AppResult<Vec<DeckWithStats>> {
        let all_decks = Self::get_all(conn)?;
        let mut result = Vec::new();

        let mut deck_stats_map = std::collections::HashMap::new();
        for d in &all_decks {
            let stats = Self::get_deck_stats(conn, &d.id)?;
            deck_stats_map.insert(d.id.clone(), stats);
        }

        // Build hierarchical tree
        let root_decks: Vec<&Deck> = all_decks.iter().filter(|d| d.parent_id.is_none()).collect();

        for root in root_decks {
            let mut node = DeckWithStats {
                deck: root.clone(),
                stats: deck_stats_map.get(&root.id).cloned().unwrap_or_default(),
                children: Vec::new(),
            };

            Self::attach_children(&mut node, &all_decks, &deck_stats_map);
            result.push(node);
        }

        Ok(result)
    }

    fn attach_children(
        parent: &mut DeckWithStats,
        all_decks: &[Deck],
        stats_map: &std::collections::HashMap<String, DeckStats>,
    ) {
        let children: Vec<&Deck> = all_decks
            .iter()
            .filter(|d| d.parent_id.as_deref() == Some(&parent.deck.id))
            .collect();

        for child in children {
            let mut child_node = DeckWithStats {
                deck: child.clone(),
                stats: stats_map.get(&child.id).cloned().unwrap_or_default(),
                children: Vec::new(),
            };
            Self::attach_children(&mut child_node, all_decks, stats_map);
            parent.children.push(child_node);
        }
    }
}
