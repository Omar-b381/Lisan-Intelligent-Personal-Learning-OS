use regex::Regex;
use super::{BookImporter, ImportError, ParsedBook, ParsedChapter};

pub struct TxtImporter;

impl TxtImporter {
    pub fn new() -> Self {
        Self
    }

    /// Decode bytes detecting UTF-16 BOM or UTF-8
    pub fn decode_text_bytes(bytes: &[u8]) -> String {
        if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
            // UTF-8 BOM
            String::from_utf8_lossy(&bytes[3..]).to_string()
        } else if bytes.starts_with(&[0xFF, 0xFE]) {
            // UTF-16 LE
            let u16_slice: Vec<u16> = bytes[2..]
                .chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .collect();
            String::from_utf16_lossy(&u16_slice)
        } else if bytes.starts_with(&[0xFE, 0xFF]) {
            // UTF-16 BE
            let u16_slice: Vec<u16> = bytes[2..]
                .chunks_exact(2)
                .map(|c| u16::from_be_bytes([c[0], c[1]]))
                .collect();
            String::from_utf16_lossy(&u16_slice)
        } else {
            String::from_utf8_lossy(bytes).to_string()
        }
    }
}

impl BookImporter for TxtImporter {
    fn parse(&self, file_bytes: &[u8], filename: &str) -> Result<ParsedBook, ImportError> {
        let text = Self::decode_text_bytes(file_bytes);
        let trimmed = text.trim();

        if trimmed.is_empty() || trimmed.split_whitespace().count() < 10 {
            return Err(ImportError::EmptyExtraction);
        }

        let default_title = filename
            .trim_end_matches(".txt")
            .trim_end_matches(".TXT")
            .to_string();

        let lines: Vec<&str> = trimmed.lines().collect();

        // Check if first line is a title
        let (title, content_start_line) = if let Some(first) = lines.first() {
            let first_clean = first.trim();
            if !first_clean.is_empty() && first_clean.len() <= 70 && !first_clean.ends_with('.') {
                (first_clean.to_string(), 1)
            } else {
                (default_title, 0)
            }
        } else {
            (default_title, 0)
        };

        let content_text = lines[content_start_line..].join("\n");

        // Chapter detection regex
        let chapter_re = Regex::new(
            r"(?im)^(?:chapter\s+\d+|act\s+\d+|scene\s+\d+|part\s+\d+|book\s+\d+|الفصل\s+[\d\p{Arabic}]+|الباب\s+[\d\p{Arabic}]+|#+\s+.+)"
        ).unwrap();

        let mut chapters = Vec::new();
        let matches: Vec<_> = chapter_re.find_iter(&content_text).collect();

        if matches.len() > 1 {
            // Split by chapter markers
            let mut last_end = 0;
            let mut last_title = Some("Prologue".to_string());

            for (idx, m) in matches.iter().enumerate() {
                if idx == 0 && m.start() > 0 {
                    let section = content_text[0..m.start()].trim();
                    if section.split_whitespace().count() >= 10 {
                        chapters.push(ParsedChapter {
                            title: last_title.clone(),
                            raw_text: section.to_string(),
                        });
                    }
                }

                if idx > 0 {
                    let section = content_text[last_end..m.start()].trim();
                    if section.split_whitespace().count() >= 10 {
                        chapters.push(ParsedChapter {
                            title: last_title.clone(),
                            raw_text: section.to_string(),
                        });
                    }
                }

                last_title = Some(m.as_str().trim_start_matches('#').trim().to_string());
                last_end = m.end();
            }

            if last_end < content_text.len() {
                let section = content_text[last_end..].trim();
                if section.split_whitespace().count() >= 10 {
                    chapters.push(ParsedChapter {
                        title: last_title,
                        raw_text: section.to_string(),
                    });
                }
            }
        }

        // If no explicit chapter markers found, chunk into ~1,500 word chapters
        if chapters.is_empty() {
            let paragraphs: Vec<&str> = content_text.split("\n\n").collect();
            let mut current_chapter = String::new();
            let mut chapter_num = 1;

            for para in paragraphs {
                let clean_p = para.trim();
                if clean_p.is_empty() {
                    continue;
                }

                current_chapter.push_str(clean_p);
                current_chapter.push_str("\n\n");

                let words = current_chapter.split_whitespace().count();
                if words >= 1200 {
                    chapters.push(ParsedChapter {
                        title: Some(format!("Chapter {}", chapter_num)),
                        raw_text: current_chapter.trim().to_string(),
                    });
                    current_chapter = String::new();
                    chapter_num += 1;
                }
            }

            if !current_chapter.trim().is_empty() {
                chapters.push(ParsedChapter {
                    title: Some(format!("Chapter {}", chapter_num)),
                    raw_text: current_chapter.trim().to_string(),
                });
            }
        }

        Ok(ParsedBook {
            title,
            author: None,
            source_format: "txt".to_string(),
            cover_image: None,
            chapters,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_txt_chapter_detection() {
        let raw = b"My Short Story\n\nChapter 1\nOnce upon a time in a faraway land there lived a wise traveler.\n\nChapter 2\nThe traveler met a companion on the road.";
        let importer = TxtImporter::new();
        let book = importer.parse(raw, "story.txt").expect("Failed to parse txt");

        assert_eq!(book.title, "My Short Story");
        assert_eq!(book.chapters.len(), 2);
        assert_eq!(book.chapters[0].title.as_deref(), Some("Chapter 1"));
        assert_eq!(book.chapters[1].title.as_deref(), Some("Chapter 2"));
    }
}
