use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use directories::ProjectDirs;
use rusqlite::Connection;

use crate::errors::{AppError, AppResult};

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
    db_path: PathBuf,
}

impl Database {
    /// Initialize SQLite database at the platform-standard AppData location
    pub fn init(custom_path: Option<PathBuf>) -> AppResult<Self> {
        let db_path = if let Some(p) = custom_path {
            p
        } else {
            let proj_dirs = ProjectDirs::from("com", "lisan", "app")
                .ok_or_else(|| AppError::Internal("Could not determine user app directory".to_string()))?;
            let data_dir = proj_dirs.data_dir();
            fs::create_dir_all(data_dir)?;
            data_dir.join("lisan.db")
        };

        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;

        // Configure performance & safety pragmas
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path,
        };

        Ok(db)
    }

    /// Create in-memory database for testing
    pub fn in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path: PathBuf::from(":memory:"),
        })
    }

    pub fn get_connection(&self) -> std::sync::MutexGuard<'_, Connection> {
        match self.conn.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        }
    }

    pub fn get_db_path(&self) -> &PathBuf {
        &self.db_path
    }
}
