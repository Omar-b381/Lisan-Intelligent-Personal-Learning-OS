use std::fs;
use std::path::PathBuf;
use directories::ProjectDirs;
use sha2::{Digest, Sha256};

use crate::database::connection::Database;
use crate::database::repositories::MediaRepository;
use crate::domain::media::MediaItem;
use crate::errors::{AppError, AppResult};

pub struct MediaService {
    db: Database,
    vault_dir: PathBuf,
}

impl MediaService {
    pub fn new(db: Database) -> AppResult<Self> {
        let proj_dirs = ProjectDirs::from("com", "lisan", "app")
            .ok_or_else(|| AppError::Internal("Could not determine user app directory".to_string()))?;
        let vault_dir = proj_dirs.data_dir().join("media");
        fs::create_dir_all(&vault_dir)?;

        Ok(Self { db, vault_dir })
    }

    pub fn add_media(&self, original_name: &str, data: &[u8], mime_type: &str) -> AppResult<MediaItem> {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let hash = format!("{:x}", hasher.finalize());

        let conn = self.db.get_connection();

        // If duplicate hash exists, reuse it
        if let Some(existing) = MediaRepository::get_by_hash(&conn, &hash)? {
            return Ok(existing);
        }

        // Determine extension
        let ext = PathBuf::from(original_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin")
            .to_string();

        let storage_filename = format!("{}.{}", hash, ext);
        let target_path = self.vault_dir.join(&storage_filename);

        fs::write(&target_path, data)?;

        let media_item = MediaRepository::insert(
            &conn,
            &storage_filename,
            original_name,
            mime_type,
            data.len() as u64,
            &hash,
        )?;

        Ok(media_item)
    }

    pub fn get_media_path(&self, filename: &str) -> AppResult<PathBuf> {
        let safe_name = PathBuf::from(filename)
            .file_name()
            .ok_or_else(|| AppError::Validation("Invalid filename".to_string()))?
            .to_os_string();

        let path = self.vault_dir.join(safe_name);
        if !path.exists() {
            return Err(AppError::NotFound(format!("Media file {} not found", filename)));
        }

        Ok(path)
    }

    pub fn get_media_base64(&self, filename: &str) -> AppResult<String> {
        use std::io::Read;
        let path = self.get_media_path(filename)?;
        let mut file = fs::File::open(path)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;

        // Simple base64 encoding without extra heavy crate
        const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut result = String::new();
        for chunk in buffer.chunks(3) {
            let b = match chunk.len() {
                3 => ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8) | (chunk[2] as u32),
                2 => ((chunk[0] as u32) << 16) | ((chunk[1] as u32) << 8),
                1 => (chunk[0] as u32) << 16,
                _ => 0,
            };

            result.push(CHARSET[((b >> 18) & 63) as usize] as char);
            result.push(CHARSET[((b >> 12) & 63) as usize] as char);

            if chunk.len() > 1 {
                result.push(CHARSET[((b >> 6) & 63) as usize] as char);
            } else {
                result.push('=');
            }

            if chunk.len() > 2 {
                result.push(CHARSET[(b & 63) as usize] as char);
            } else {
                result.push('=');
            }
        }

        Ok(result)
    }
}
