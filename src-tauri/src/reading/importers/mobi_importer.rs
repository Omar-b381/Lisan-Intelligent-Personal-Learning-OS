use super::drm_guard::DrmGuard;
use super::epub_importer::EpubImporter;
use super::{BookImporter, ImportError, ParsedBook, ParsedChapter};

pub struct MobiImporter;

impl MobiImporter {
    pub fn new() -> Self {
        Self
    }

    /// Decompress a single PalmDOC LZ77 record into bytes
    pub fn decompress_palmdoc_record(input: &[u8]) -> Result<Vec<u8>, ImportError> {
        let mut out = Vec::with_capacity(input.len() * 2);
        let mut i = 0;

        while i < input.len() {
            let byte = input[i];
            i += 1;

            if byte == 0x00 {
                out.push(0x00);
            } else if byte >= 0x01 && byte <= 0x08 {
                // Next N bytes are literal
                let count = byte as usize;
                if i + count > input.len() {
                    break;
                }
                out.extend_from_slice(&input[i..i + count]);
                i += count;
            } else if byte >= 0x09 && byte <= 0x7F {
                // Single literal character
                out.push(byte);
            } else if byte >= 0x80 && byte <= 0xBF {
                // Two-byte distance & length
                if i >= input.len() {
                    break;
                }
                let next = input[i];
                i += 1;

                let distance = ((((byte as usize) & 0x3F) << 3) | ((next as usize) >> 5)) as usize;
                let length = ((next as usize) & 0x1F) + 3;

                if distance == 0 || distance > out.len() {
                    // Invalid reference
                    continue;
                }

                let start_idx = out.len() - distance;
                for k in 0..length {
                    let ch = out[start_idx + (k % distance)];
                    out.push(ch);
                }
            } else {
                // 0xC0..=0xFF: space + (byte ^ 0x80)
                out.push(b' ');
                out.push(byte ^ 0x80);
            }
        }

        Ok(out)
    }
}

impl BookImporter for MobiImporter {
    fn parse(&self, file_bytes: &[u8], filename: &str) -> Result<ParsedBook, ImportError> {
        // 1. DRM check
        DrmGuard::check_mobi_drm(file_bytes)?;

        if file_bytes.len() < 86 {
            return Err(ImportError::UnsupportedOrCorrupted("MOBI file too small".to_string()));
        }

        // 2. Parse PDB record list
        let num_records = u16::from_be_bytes([file_bytes[76], file_bytes[77]]) as usize;
        if num_records < 2 {
            return Err(ImportError::UnsupportedOrCorrupted("Invalid MOBI record count".to_string()));
        }

        let mut record_offsets = Vec::with_capacity(num_records);
        for r in 0..num_records {
            let offset_pos = 78 + (r * 8);
            if offset_pos + 4 > file_bytes.len() {
                break;
            }
            let rec_off = u32::from_be_bytes([
                file_bytes[offset_pos],
                file_bytes[offset_pos + 1],
                file_bytes[offset_pos + 2],
                file_bytes[offset_pos + 3],
            ]) as usize;
            record_offsets.push(rec_off);
        }

        if record_offsets.is_empty() {
            return Err(ImportError::UnsupportedOrCorrupted("Could not parse MOBI records".to_string()));
        }

        // Record 0 holds PalmDOC and MOBI header
        let rec0_start = record_offsets[0];
        let rec0_end = if record_offsets.len() > 1 {
            record_offsets[1]
        } else {
            file_bytes.len()
        };

        if rec0_start >= file_bytes.len() || rec0_end > file_bytes.len() || rec0_end <= rec0_start {
            return Err(ImportError::UnsupportedOrCorrupted("Invalid MOBI record 0 boundaries".to_string()));
        }

        let rec0 = &file_bytes[rec0_start..rec0_end];
        if rec0.len() < 16 {
            return Err(ImportError::UnsupportedOrCorrupted("MOBI header too short".to_string()));
        }

        let compression = u16::from_be_bytes([rec0[0], rec0[1]]);
        let text_record_count = u16::from_be_bytes([rec0[8], rec0[9]]) as usize;

        // Extract title from MOBI header if present
        let mut title = filename
            .trim_end_matches(".mobi")
            .trim_end_matches(".azw3")
            .trim_end_matches(".azw")
            .to_string();

        if rec0.len() >= 92 {
            let full_name_offset = u32::from_be_bytes([rec0[84], rec0[85], rec0[86], rec0[87]]) as usize;
            let full_name_length = u32::from_be_bytes([rec0[88], rec0[89], rec0[90], rec0[91]]) as usize;

            if full_name_offset + full_name_length <= rec0.len() {
                if let Ok(mobi_title) = std::str::from_utf8(&rec0[full_name_offset..full_name_offset + full_name_length]) {
                    let clean = mobi_title.trim();
                    if !clean.is_empty() {
                        title = clean.to_string();
                    }
                }
            }
        }

        // 3. Decompress text records (1..=text_record_count)
        let mut full_html_bytes = Vec::new();
        let max_text_recs = text_record_count.min(record_offsets.len() - 1);

        for r in 1..=max_text_recs {
            let r_start = record_offsets[r];
            let r_end = if r + 1 < record_offsets.len() {
                record_offsets[r + 1]
            } else {
                file_bytes.len()
            };

            if r_start >= file_bytes.len() || r_end > file_bytes.len() || r_end <= r_start {
                continue;
            }

            let slice = &file_bytes[r_start..r_end];
            match compression {
                1 => {
                    // Uncompressed
                    full_html_bytes.extend_from_slice(slice);
                }
                2 => {
                    // PalmDOC LZ77
                    if let Ok(decompressed) = Self::decompress_palmdoc_record(slice) {
                        full_html_bytes.extend(decompressed);
                    }
                }
                _ => {
                    // Unsupported compression (e.g. Huff/CDIC)
                    return Err(ImportError::UnsupportedOrCorrupted("MOBI compression format not supported in this version".to_string()));
                }
            }
        }

        if full_html_bytes.is_empty() {
            return Err(ImportError::EmptyExtraction);
        }

        let raw_html = String::from_utf8_lossy(&full_html_bytes);
        let clean_text = EpubImporter::clean_html_to_text(&raw_html);

        if clean_text.split_whitespace().count() < 10 {
            return Err(ImportError::EmptyExtraction);
        }

        // Chunk into ~1500 word chapters
        let paragraphs: Vec<&str> = clean_text.split("\n\n").collect();
        let mut chapters = Vec::new();
        let mut current_ch = String::new();
        let mut ch_idx = 1;

        for p in paragraphs {
            let clean_p = p.trim();
            if clean_p.is_empty() {
                continue;
            }
            current_ch.push_str(clean_p);
            current_ch.push_str("\n\n");

            if current_ch.split_whitespace().count() >= 1200 {
                chapters.push(ParsedChapter {
                    title: Some(format!("Chapter {}", ch_idx)),
                    raw_text: current_ch.trim().to_string(),
                });
                current_ch = String::new();
                ch_idx += 1;
            }
        }

        if !current_ch.trim().is_empty() {
            chapters.push(ParsedChapter {
                title: Some(format!("Chapter {}", ch_idx)),
                raw_text: current_ch.trim().to_string(),
            });
        }

        Ok(ParsedBook {
            title,
            author: None,
            source_format: "mobi_drm_free".to_string(),
            cover_image: None,
            chapters,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_palmdoc_decompression() {
        // "Hello world" with space+w
        // 'H','e','l','l','o' (5 literals), space+'w' (0xC0 ^ 'w') = 0x80 | 0x77 = 0xF7, 'o','r','l','d'
        let input = vec![b'H', b'e', b'l', b'l', b'o', 0x80 | b'w', b'o', b'r', b'l', b'd'];
        let out = MobiImporter::decompress_palmdoc_record(&input).unwrap();
        assert_eq!(String::from_utf8_lossy(&out), "Hello world");
    }
}
