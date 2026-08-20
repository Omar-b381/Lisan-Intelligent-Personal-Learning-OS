use chrono::Utc;
use rusqlite::{params, Connection};

use crate::domain::settings::AppSettings;
use crate::errors::AppResult;

pub struct SettingsRepository;

impl SettingsRepository {
    pub fn get_app_settings(conn: &Connection) -> AppResult<AppSettings> {
        let json_str: Option<String> = conn.query_row(
            "SELECT value FROM settings WHERE key = 'app_settings'",
            [],
            |r| r.get(0),
        ).ok();

        if let Some(s) = json_str {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&s) {
                return Ok(settings);
            }
        }

        Ok(AppSettings::default())
    }

    pub fn save_app_settings(conn: &Connection, settings: &AppSettings) -> AppResult<()> {
        let json_str = serde_json::to_string(settings)?;
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES ('app_settings', ?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2",
            params![json_str, now],
        )?;

        Ok(())
    }
}
