use chrono::Utc;
use rusqlite::params;

use crate::errors::AppResult;
use super::connection::Database;

const MIGRATION_001: &str = include_str!("migrations/001_initial.sql");
const MIGRATION_002: &str = include_str!("migrations/002_seed.sql");
const MIGRATION_003: &str = include_str!("migrations/003_tts_audio.sql");

pub struct Migration {
    pub version: i32,
    pub name: &'static str,
    pub sql: &'static str,
}

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            name: "001_initial",
            sql: MIGRATION_001,
        },
        Migration {
            version: 2,
            name: "002_seed",
            sql: MIGRATION_002,
        },
        Migration {
            version: 3,
            name: "003_tts_audio",
            sql: MIGRATION_003,
        },
    ]
}

pub fn run_migrations(db: &Database) -> AppResult<()> {
    let mut conn = db.get_connection();
    
    // Create migrations tracker if not exists
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        )",
        [],
    )?;

    let migrations = get_migrations();

    for migration in migrations {
        let already_applied: bool = conn
            .query_row(
                "SELECT COUNT(1) FROM schema_migrations WHERE version = ?1",
                params![migration.version],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)
            .unwrap_or(false);

        if !already_applied {
            let tx = conn.transaction()?;
            tx.execute_batch(migration.sql)?;
            tx.execute(
                "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
                params![
                    migration.version,
                    migration.name,
                    Utc::now().to_rfc3339()
                ],
            )?;
            tx.commit()?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrations_execute_cleanly() {
        let db = Database::in_memory().expect("Failed to create in-memory db");
        let res = run_migrations(&db);
        assert!(res.is_ok());

        let conn = db.get_connection();
        let count: i64 = conn
            .query_row("SELECT COUNT(1) FROM schema_migrations", [], |r| r.get(0))
            .expect("Failed to count migrations");
        assert_eq!(count, 2);

        let card_count: i64 = conn
            .query_row("SELECT COUNT(1) FROM cards", [], |r| r.get(0))
            .expect("Failed to count cards");
        assert!(card_count > 0);
    }
}
