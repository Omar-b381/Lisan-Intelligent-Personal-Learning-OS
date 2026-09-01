use std::collections::HashMap;
use std::io::{Cursor, Read};
use regex::Regex;
use super::drm_guard::DrmGuard;
use super::{BookImporter, ImportError, ParsedBook, ParsedChapter};

pub struct EpubImporter;

impl EpubImporter {
    pub fn new() -> Self {
        Self
    }

    /// Strip HTML/XHTML tags, convert paragraphs and linebreaks, decode HTML entities.
    pub fn clean_html_to_text(html: &str) -> String {
        // 1. Remove <head>...</head>, <script>...</script>, <style>...</style>
        let head_re = Regex::new(r"(?is)<head[^>]*>.*?</head>").unwrap();
        let script_re = Regex::new(r"(?is)<script[^>]*>.*?</script>").unwrap();
        let style_re = Regex::new(r"(?is)<style[^>]*>.*?</style>").unwrap();
        let s1 = head_re.replace_all(html, " ");
        let s2 = script_re.replace_all(&s1, " ");
        let stripped = style_re.replace_all(&s2, " ");

        // 2. Replace block level tags with newlines
        let block_re = Regex::new(r"(?i)</?(p|div|h[1-6]|br|li|tr|blockquote|section|article)[^>]*>").unwrap();
        let with_newlines = block_re.replace_all(&stripped, "\n");

        // 3. Remove all remaining tags
        let tag_re = Regex::new(r"<[^>]+>").unwrap();
        let no_tags = tag_re.replace_all(&with_newlines, " ");

        // 4. Decode common HTML entities
        let text = decode_html_entities(&no_tags);

        // 5. Clean excessive whitespace and normalize linebreaks
        let multi_space_re = Regex::new(r"[ \t]+").unwrap();
        let clean_spaces = multi_space_re.replace_all(&text, " ");

        let multi_newline_re = Regex::new(r"\n{3,}").unwrap();
        let clean_newlines = multi_newline_re.replace_all(&clean_spaces, "\n\n");

        clean_newlines.trim().to_string()
    }

    /// Extract first heading or title from HTML chapter
    pub fn extract_chapter_title(html: &str) -> Option<String> {
        let heading_re = Regex::new(r"(?is)<h[1-3][^>]*>(.*?)</h[1-3]>").unwrap();
        if let Some(caps) = heading_re.captures(html) {
            let heading = &caps[1];
            let clean = Self::clean_html_to_text(heading);
            if !clean.is_empty() && clean.len() <= 100 {
                return Some(clean);
            }
        }
        None
    }
}

impl BookImporter for EpubImporter {
    fn parse(&self, file_bytes: &[u8], filename: &str) -> Result<ParsedBook, ImportError> {
        // 1. DRM Guard verification
        DrmGuard::check_epub_drm(file_bytes)?;

        let cursor = Cursor::new(file_bytes);
        let mut archive = zip::ZipArchive::new(cursor)
            .map_err(|e| ImportError::UnsupportedOrCorrupted(format!("Failed to read EPUB zip: {}", e)))?;

        // 2. Find container.xml to locate OPF package file
        let mut opf_path = String::from("OEBPS/content.opf");
        for i in 0..archive.len() {
            if let Ok(mut file) = archive.by_index(i) {
                if file.name().to_lowercase() == "meta-inf/container.xml" {
                    let mut container_xml = String::new();
                    let _ = file.read_to_string(&mut container_xml);
                    if let Some(path) = extract_attr_value(&container_xml, "full-path") {
                        opf_path = path;
                    }
                    break;
                }
            }
        }

        // 3. Read OPF file content
        let mut opf_content = String::new();
        let mut found_opf = false;
        for i in 0..archive.len() {
            if let Ok(mut file) = archive.by_index(i) {
                if file.name() == opf_path || file.name().to_lowercase().ends_with(".opf") {
                    let _ = file.read_to_string(&mut opf_content);
                    opf_path = file.name().to_string();
                    found_opf = true;
                    break;
                }
            }
        }

        if !found_opf || opf_content.is_empty() {
            return Err(ImportError::UnsupportedOrCorrupted("Could not find OPF package metadata in EPUB".to_string()));
        }

        let opf_base_dir = if let Some(idx) = opf_path.rfind('/') {
            &opf_path[..=idx]
        } else {
            ""
        };

        // 4. Extract metadata: title and creator (author)
        let title = extract_tag_content(&opf_content, "dc:title")
            .or_else(|| extract_tag_content(&opf_content, "title"))
            .unwrap_or_else(|| {
                filename.trim_end_matches(".epub").trim_end_matches(".EPUB").to_string()
            });

        let author = extract_tag_content(&opf_content, "dc:creator")
            .or_else(|| extract_tag_content(&opf_content, "creator"));

        // 5. Parse manifest items (id -> href, media-type)
        let mut manifest: HashMap<String, (String, String)> = HashMap::new(); // id -> (resolved_path, media_type)
        let mut cover_item_id = None;

        let item_re = Regex::new(r#"(?is)<item\s+([^>]+)/?>"#).unwrap();
        for caps in item_re.captures_iter(&opf_content) {
            let attrs = &caps[1];
            let id = extract_attr_value(attrs, "id");
            let href = extract_attr_value(attrs, "href");
            let media_type = extract_attr_value(attrs, "media-type").unwrap_or_default();
            let properties = extract_attr_value(attrs, "properties").unwrap_or_default();

            if let (Some(id), Some(href)) = (id, href) {
                let resolved_path = resolve_relative_path(opf_base_dir, &href);
                if properties.contains("cover-image") || id.to_lowercase().contains("cover") {
                    cover_item_id = Some(id.clone());
                }
                manifest.insert(id, (resolved_path, media_type));
            }
        }

        // Check <meta name="cover" content="...">
        let meta_cover_re = Regex::new(r#"(?i)<meta\s+name=["']cover["']\s+content=["']([^"']+)["']"#).unwrap();
        if let Some(caps) = meta_cover_re.captures(&opf_content) {
            cover_item_id = Some(caps[1].to_string());
        }

        // Extract cover image if found
        let mut cover_image = None;
        if let Some(cover_id) = cover_item_id {
            if let Some((cover_path, media_type)) = manifest.get(&cover_id) {
                for i in 0..archive.len() {
                    if let Ok(mut file) = archive.by_index(i) {
                        if file.name() == cover_path || file.name().ends_with(cover_path.as_str()) {
                            let mut img_bytes = Vec::new();
                            if file.read_to_end(&mut img_bytes).is_ok() && !img_bytes.is_empty() {
                                cover_image = Some((img_bytes, media_type.clone()));
                                break;
                            }
                        }
                    }
                }
            }
        }

        // 6. Parse spine (reading order of chapters)
        let mut spine_order = Vec::new();
        let itemref_re = Regex::new(r#"(?is)<itemref\s+([^>]+)/?>"#).unwrap();
        for caps in itemref_re.captures_iter(&opf_content) {
            let attrs = &caps[1];
            if let Some(idref) = extract_attr_value(attrs, "idref") {
                spine_order.push(idref);
            }
        }

        // 7. Read chapters in spine order
        let mut chapters = Vec::new();
        for idref in spine_order {
            if let Some((chapter_path, media_type)) = manifest.get(&idref) {
                // Must be HTML/XHTML
                if media_type.contains("html") || media_type.contains("xml") || chapter_path.ends_with(".html") || chapter_path.ends_with(".xhtml") || chapter_path.ends_with(".htm") {
                    for i in 0..archive.len() {
                        if let Ok(mut file) = archive.by_index(i) {
                            if file.name() == chapter_path || file.name().ends_with(chapter_path.as_str()) {
                                let mut html = String::new();
                                if file.read_to_string(&mut html).is_ok() {
                                    let chapter_title = Self::extract_chapter_title(&html);
                                    let clean_text = Self::clean_html_to_text(&html);
                                    let words = clean_text.split_whitespace().count();
                                    if words >= 5 {
                                        chapters.push(ParsedChapter {
                                            title: chapter_title,
                                            raw_text: clean_text,
                                        });
                                    }
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Fallback: If spine was empty, grab all html files in archive
        if chapters.is_empty() {
            for i in 0..archive.len() {
                if let Ok(mut file) = archive.by_index(i) {
                    let name = file.name().to_string();
                    if name.ends_with(".xhtml") || name.ends_with(".html") || name.ends_with(".htm") {
                        let mut html = String::new();
                        if file.read_to_string(&mut html).is_ok() {
                            let chapter_title = Self::extract_chapter_title(&html);
                            let clean_text = Self::clean_html_to_text(&html);
                            if clean_text.split_whitespace().count() >= 5 {
                                chapters.push(ParsedChapter {
                                    title: chapter_title,
                                    raw_text: clean_text,
                                });
                            }
                        }
                    }
                }
            }
        }

        if chapters.is_empty() {
            return Err(ImportError::EmptyExtraction);
        }

        Ok(ParsedBook {
            title,
            author,
            source_format: "epub".to_string(),
            cover_image,
            chapters,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn extract_tag_content(xml: &str, tag_name: &str) -> Option<String> {
    let pattern = format!(r"(?is)<{}[^>]*>(.*?)</{}>", regex::escape(tag_name), regex::escape(tag_name));
    let re = Regex::new(&pattern).ok()?;
    let caps = re.captures(xml)?;
    let raw = caps.get(1)?.as_str().trim();
    let cleaned = decode_html_entities(raw);
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn extract_attr_value(tag_str: &str, attr_name: &str) -> Option<String> {
    let pattern = format!(r#"(?i){}\s*=\s*["']([^"']+)["']"#, regex::escape(attr_name));
    let re = Regex::new(&pattern).ok()?;
    let caps = re.captures(tag_str)?;
    Some(caps.get(1)?.as_str().trim().to_string())
}

fn resolve_relative_path(base_dir: &str, href: &str) -> String {
    let clean_href = href.split('#').next().unwrap_or(href); // strip fragment identifier
    if clean_href.starts_with('/') {
        clean_href.trim_start_matches('/').to_string()
    } else {
        format!("{}{}", base_dir, clean_href)
    }
}

fn decode_html_entities(text: &str) -> String {
    let mut s = text.to_string();
    s = s.replace("&nbsp;", " ");
    s = s.replace("&amp;", "&");
    s = s.replace("&lt;", "<");
    s = s.replace("&gt;", ">");
    s = s.replace("&quot;", "\"");
    s = s.replace("&apos;", "'");
    s = s.replace("&#39;", "'");
    s = s.replace("&mdash;", "—");
    s = s.replace("&ndash;", "–");
    s = s.replace("&hellip;", "…");
    s = s.replace("&rsquo;", "'");
    s = s.replace("&lsquo;", "'");
    s = s.replace("&rdquo;", "\"");
    s = s.replace("&ldquo;", "\"");
    s = s.replace("&#160;", " ");

    // Numeric decimal entities &#123;
    let dec_re = Regex::new(r"&#(\d+);").unwrap();
    s = dec_re.replace_all(&s, |caps: &regex::Captures| {
        if let Ok(code) = caps[1].parse::<u32>() {
            if let Some(ch) = char::from_u32(code) {
                return ch.to_string();
            }
        }
        caps[0].to_string()
    }).to_string();

    // Numeric hex entities &#x1F;
    let hex_re = Regex::new(r"(?i)&#x([0-9a-f]+);").unwrap();
    s = hex_re.replace_all(&s, |caps: &regex::Captures| {
        if let Ok(code) = u32::from_str_radix(&caps[1], 16) {
            if let Some(ch) = char::from_u32(code) {
                return ch.to_string();
            }
        }
        caps[0].to_string()
    }).to_string();

    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_html_to_text() {
        let html = r#"
            <html>
                <head><title>Test Title</title><style>p { color: red; }</style></head>
                <body>
                    <h1>Chapter 1: The Beginning</h1>
                    <p>It was the best of times, &amp; it was the worst of times.</p>
                    <p>Second paragraph with &ldquo;quotes&rdquo; and &mdash; dashes.</p>
                </body>
            </html>
        "#;

        let cleaned = EpubImporter::clean_html_to_text(html);
        assert!(cleaned.contains("Chapter 1: The Beginning"));
        assert!(cleaned.contains("It was the best of times, & it was the worst of times."));
        assert!(cleaned.contains("Second paragraph with \"quotes\" and — dashes."));
        assert!(!cleaned.contains("<style>"));
    }

    #[test]
    fn test_epub_parse_minimal() {
        use std::io::Write;
        let mut buf = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buf);
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored);

            zip.start_file("mimetype", options).unwrap();
            zip.write_all(b"application/epub+zip").unwrap();

            zip.start_file("META-INF/container.xml", options).unwrap();
            zip.write_all(br#"<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#).unwrap();

            zip.start_file("OEBPS/content.opf", options).unwrap();
            zip.write_all(br#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>A Tale of Two Cities</dc:title>
    <dc:creator>Charles Dickens</dc:creator>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>"#).unwrap();

            zip.start_file("OEBPS/ch1.xhtml", options).unwrap();
            zip.write_all(br#"<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter I</title><style>.p { margin: 0; }</style></head>
<body>
<h1>Chapter I: The Period</h1>
<p>It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness.</p>
</body>
</html>"#).unwrap();

            zip.finish().unwrap();
        }

        let bytes = buf.into_inner();
        let importer = EpubImporter::new();
        let book = importer.parse(&bytes, "test.epub").expect("Failed to parse minimal EPUB");

        assert_eq!(book.title, "A Tale of Two Cities");
        assert_eq!(book.author.as_deref(), Some("Charles Dickens"));
        assert_eq!(book.chapters.len(), 1);
        assert!(book.chapters[0].raw_text.contains("It was the best of times"));
    }
}
