use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Scheduler error: {0}")]
    Scheduler(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Media error: {0}")]
    Media(String),

    #[error("Import/Export error: {0}")]
    ImportExport(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let (code, message) = match self {
            AppError::Database(e) => ("DATABASE_ERROR", e.to_string()),
            AppError::NotFound(msg) => ("NOT_FOUND", msg.clone()),
            AppError::Validation(msg) => ("VALIDATION_ERROR", msg.clone()),
            AppError::Scheduler(msg) => ("SCHEDULER_ERROR", msg.clone()),
            AppError::Io(e) => ("IO_ERROR", e.to_string()),
            AppError::Serialization(e) => ("SERIALIZATION_ERROR", e.to_string()),
            AppError::Media(msg) => ("MEDIA_ERROR", msg.clone()),
            AppError::ImportExport(msg) => ("IMPORT_EXPORT_ERROR", msg.clone()),
            AppError::Internal(msg) => ("INTERNAL_ERROR", msg.clone()),
        };

        let response = ErrorResponse {
            code: code.to_string(),
            message,
        };
        response.serialize(serializer)
    }
}

pub type AppResult<T> = Result<T, AppError>;
