use regex::Regex;
use super::drm_guard::DrmGuard;
use super::{BookImporter, ImportError, ParsedBook, ParsedChapter};

pub struct PdfImporter;

impl PdfImporter {
    pub fn new() -> Self {
        Self
    }

    /// Validates text quality to catch scanned image PDFs or unresolvable CMap font encodings
    pub fn validate_extracted_text(text: &str) -> Result<(), ImportError> {
        let trimmed = text.trim();
        let char_count = trimmed.chars().count();

        // 1. If text is virtually empty (scanned image PDF)
        if char_count < 50 {
            return Err(ImportError::EmptyExtraction);
        }

        // 2. Count printable and alphabetic characters vs corrupted unmapped glyphs
        let mut alpha_count = 0;
        let mut printable_count = 0;
        let mut total_count = 0;

        for ch in trimmed.chars() {
            total_count += 1;
            if ch.is_alphanumeric() {
                alpha_count += 1;
            }
            if !ch.is_control() || ch == '\n' || ch == '\t' || ch == ' ' {
                printable_count += 1;
            }
        }

        if total_count == 0 {
            return Err(ImportError::EmptyExtraction);
        }

        let alpha_ratio = (alpha_count as f64) / (total_count as f64);
        let printable_ratio = (printable_count as f64) / (total_count as f64);

        // If text is mostly garbled bytes (e.g. font encoding missing / binary noise)
        if printable_ratio < 0.70 || alpha_ratio < 0.35 {
            return Err(ImportError::EmptyExtraction);
        }

        Ok(())
    }

    /// Clean PDF extracted text, remove excessive hyphenations and normalize spacing
    pub fn clean_pdf_text(text: &str) -> String {
        // Remove soft hyphens at line endings (e.g. "com-\nputer" -> "computer")
        let dehyphen_re = Regex::new(r"(\b[a-zA-Z]{2,})-\r?\n([a-zA-Z]{2,}\b)").unwrap();
        let unhyphenated = dehyphen_re.replace_all(text, "$1$2");

        // Normalize form feed / page markers
        let page_break_re = Regex::new(r"[\x0C\f]+").unwrap();
        let with_breaks = page_break_re.replace_all(&unhyphenated, "\n\n--- PAGE BREAK ---\n\n");

        // Normalize multiple spaces
        let space_re = Regex::new(r"[ \t]+").unwrap();
        let clean_spaces = space_re.replace_all(&with_breaks, " ");

        // Normalize excessive blank lines
        let newline_re = Regex::new(r"\n{3,}").unwrap();
        let clean_newlines = newline_re.replace_all(&clean_spaces, "\n\n");

        clean_newlines.trim().to_string()
    }
}

impl BookImporter for PdfImporter {
    fn parse(&self, file_bytes: &[u8], filename: &str) -> Result<ParsedBook, ImportError> {
        // 1. DRM check
        DrmGuard::check_pdf_drm(file_bytes)?;

        // 2. High-level text extraction with CMap, font mapping, and encoding support
        let raw_text = pdf_extract::extract_text_from_mem(file_bytes)
            .map_err(|e| {
                let err_str = e.to_string();
                if err_str.to_lowercase().contains("encrypt") {
                    ImportError::DrmProtected
                } else {
                    ImportError::EmptyExtraction
                }
            })?;

        // 3. Strict quality validation
        Self::validate_extracted_text(&raw_text)?;

        let cleaned = Self::clean_pdf_text(&raw_text);

        // 4. Split into chapters/sections (by page breaks or word groups)
        let pages: Vec<&str> = cleaned.split("--- PAGE BREAK ---").collect();
        let mut chapters = Vec::new();

        let title = filename
            .trim_end_matches(".pdf")
            .trim_end_matches(".PDF")
            .to_string();

        if pages.len() > 1 {
            // Group pages into ~1000-word logical chapters
            let mut current_chapter_text = String::new();
            let mut chapter_idx = 1;

            for page in pages {
                let clean_p = page.trim();
                if clean_p.is_empty() {
                    continue;
                }

                current_chapter_text.push_str(clean_p);
                current_chapter_text.push_str("\n\n");

                let words = current_chapter_text.split_whitespace().count();
                if words >= 800 {
                    chapters.push(ParsedChapter {
                        title: Some(format!("Section {}", chapter_idx)),
                        raw_text: current_chapter_text.trim().to_string(),
                    });
                    current_chapter_text = String::new();
                    chapter_idx += 1;
                }
            }

            if !current_chapter_text.trim().is_empty() {
                chapters.push(ParsedChapter {
                    title: Some(format!("Section {}", chapter_idx)),
                    raw_text: current_chapter_text.trim().to_string(),
                });
            }
        } else {
            chapters.push(ParsedChapter {
                title: Some("Document".to_string()),
                raw_text: cleaned,
            });
        }

        if chapters.is_empty() {
            return Err(ImportError::EmptyExtraction);
        }

        Ok(ParsedBook {
            title,
            author: None,
            source_format: "pdf".to_string(),
            cover_image: None,
            chapters,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_pdf_text_fails_validation() {
        assert!(PdfImporter::validate_extracted_text("").is_err());
        assert!(PdfImporter::validate_extracted_text("   \n\n  ").is_err());
        assert!(PdfImporter::validate_extracted_text("Page 1").is_err());
    }

    #[test]
    fn test_valid_english_text_passes_validation() {
        let text = "This is a complete sample English textbook with clear sentences and standard font encodings.";
        assert!(PdfImporter::validate_extracted_text(text).is_ok());
    }

    #[test]
    fn test_dehyphenation() {
        let text = "This is an infor-\nmation system.";
        let cleaned = PdfImporter::clean_pdf_text(text);
        assert!(cleaned.contains("information system."));
    }
}
