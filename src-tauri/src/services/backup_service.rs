use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};

use crate::database::connection::Database;
use crate::errors::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFileInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

pub struct BackupService {
    db: Database,
    backups_dir: PathBuf,
}

impl BackupService {
    pub fn new(db: Database) -> AppResult<Self> {
        let proj_dirs = ProjectDirs::from("com", "lisan", "app")
            .ok_or_else(|| AppError::Internal("Could not determine user app directory".to_string()))?;
        let backups_dir = proj_dirs.data_dir().join("backups");
        fs::create_dir_all(&backups_dir)?;

        Ok(Self { db, backups_dir })
    }

    pub fn create_backup(&self) -> AppResult<BackupFileInfo> {
        let now = Utc::now();
        let timestamp = now.format("%Y-%m-%d_%H%M%S").to_string();
        let filename = format!("backup_{}.db", timestamp);
        let target_path = self.backups_dir.join(&filename);

        let conn = self.db.get_connection();
        let target_str = target_path.to_string_lossy().to_string();

        // Use SQLite's safe VACUUM INTO command for zero-downtime atomic backup
        conn.execute("VACUUM INTO ?1", [&target_str])?;

        let metadata = fs::metadata(&target_path)?;

        Ok(BackupFileInfo {
            filename,
            path: target_str,
            size_bytes: metadata.len(),
            created_at: now.to_rfc3339(),
        })
    }

    pub fn list_backups(&self) -> AppResult<Vec<BackupFileInfo>> {
        let mut list = Vec::new();
        if self.backups_dir.exists() {
            for entry in fs::read_dir(&self.backups_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("db") {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    let metadata = entry.metadata()?;
                    let created_at = metadata
                        .created()
                        .ok()
                        .map(|t| chrono::DateTime::<Utc>::from(t).to_rfc3339())
                        .unwrap_or_else(|| Utc::now().to_rfc3339());

                    list.push(BackupFileInfo {
                        filename,
                        path: path.to_string_lossy().to_string(),
                        size_bytes: metadata.len(),
                        created_at,
                    });
                }
            }
        }

        // Sort descending (newest first)
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(list)
    }
}
