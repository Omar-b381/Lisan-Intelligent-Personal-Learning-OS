pub mod drm_guard;
pub mod epub_importer;
pub mod pdf_importer;
pub mod txt_importer;
pub mod mobi_importer;

use thiserror::Error;

#[derive(Debug, Clone, Error)]
pub enum ImportError {
    #[error("هذا الملف محمي بحماية حقوق نشر (DRM) ولا يمكن استيراده. استورد فقط نسخاً غير محمية (كتب مجال عام، إصدارات DRM-free، أو محتوى من تأليفك).")]
    DrmProtected,

    #[error("صيغة الملف غير مدعومة أو أن الملف تالف: {0}")]
    UnsupportedOrCorrupted(String),

    #[error("هذا الملف يبدو صوراً ممسوحة ضوئياً أو نصاً غير قابل للقراءة ولا يمكن استخراج نص منه في هذا الإصدار.")]
    EmptyExtraction,

    #[error("خطأ في قراءة الملف: {0}")]
    Io(String),
}

#[derive(Debug, Clone)]
pub struct ParsedChapter {
    pub title: Option<String>,
    pub raw_text: String,
}

#[derive(Debug, Clone)]
pub struct ParsedBook {
    pub title: String,
    pub author: Option<String>,
    pub source_format: String,
    pub cover_image: Option<(Vec<u8>, String)>, // (image_bytes, mime_type)
    pub chapters: Vec<ParsedChapter>,
}

pub trait BookImporter: Send + Sync {
    fn parse(&self, file_bytes: &[u8], filename: &str) -> Result<ParsedBook, ImportError>;
}
