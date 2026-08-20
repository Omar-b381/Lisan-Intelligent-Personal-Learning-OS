use crate::database::connection::Database;
use crate::database::repositories::PomodoroRepository;
use crate::domain::pomodoro::{PomodoroConfig, PomodoroMode, PomodoroSession, PomodoroSessionSummary};
use crate::errors::AppResult;

pub struct PomodoroService {
    db: Database,
}

impl PomodoroService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn start_pomodoro(&self, mode: PomodoroMode, target_duration_secs: u32) -> AppResult<PomodoroSession> {
        let conn = self.db.get_connection();
        PomodoroRepository::start(&conn, mode, target_duration_secs)
    }

    pub fn complete_pomodoro(&self, id: &str, actual_duration_secs: u32) -> AppResult<PomodoroSessionSummary> {
        let conn = self.db.get_connection();
        PomodoroRepository::complete(&conn, id, actual_duration_secs)
    }

    pub fn get_config(&self) -> AppResult<PomodoroConfig> {
        let conn = self.db.get_connection();
        PomodoroRepository::get_config(&conn)
    }

    pub fn save_config(&self, config: PomodoroConfig) -> AppResult<()> {
        let conn = self.db.get_connection();
        PomodoroRepository::save_config(&conn, &config)
    }
}
