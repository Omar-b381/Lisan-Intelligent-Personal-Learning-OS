use std::io::Cursor;
use super::ImportError;

pub struct DrmGuard;

impl DrmGuard {
    /// Inspect file bytes according to format and reject immediately if DRM is detected.
    pub fn check_drm(file_bytes: &[u8], format: &str) -> Result<(), ImportError> {
        match format.to_lowercase().as_str() {
            "epub" => Self::check_epub_drm(file_bytes),
            "pdf" => Self::check_pdf_drm(file_bytes),
            "mobi" | "azw" | "azw3" | "mobi_drm_free" => Self::check_mobi_drm(file_bytes),
            "txt" => Ok(()), // Plain text has no DRM
            _ => Ok(()),
        }
    }

    /// Check EPUB archive for DRM markers (Adobe ADEPT, rights.xml, encryption.xml)
    pub fn check_epub_drm(bytes: &[u8]) -> Result<(), ImportError> {
        let cursor = Cursor::new(bytes);
        let mut archive = match zip::ZipArchive::new(cursor) {
            Ok(a) => a,
            Err(_) => return Err(ImportError::UnsupportedOrCorrupted("Invalid EPUB zip archive".to_string())),
        };

        for i in 0..archive.len() {
            let mut file = match archive.by_index(i) {
                Ok(f) => f,
                Err(_) => continue,
            };

            let name = file.name().to_string();
            let lower_name = name.to_lowercase();

            // 1. Check for rights.xml
            if lower_name == "meta-inf/rights.xml" || lower_name.ends_with("/rights.xml") {
                use std::io::Read;
                let mut content = String::new();
                if file.read_to_string(&mut content).is_ok() && !content.trim().is_empty() {
                    return Err(ImportError::DrmProtected);
                }
            }

            // 2. Check for encryption.xml
            if lower_name == "meta-inf/encryption.xml" || lower_name.ends_with("/encryption.xml") {
                use std::io::Read;
                let mut content = String::new();
                if file.read_to_string(&mut content).is_ok() {
                    let lower_content = content.to_lowercase();
                    // Check if encryption targets documents (not just standard font obfuscation)
                    if lower_content.contains("http://ns.adobe.com/adept")
                        || lower_content.contains("adept:licensetoken")
                        || lower_content.contains("cipherdata")
                        || (lower_content.contains("encrypteddata") && !lower_content.contains("font"))
                    {
                        return Err(ImportError::DrmProtected);
                    }
                }
            }

            // 3. Check for Adobe ADEPT signpost files
            if lower_name.contains("adept") || lower_name.contains("rights.xml") {
                return Err(ImportError::DrmProtected);
            }
        }

        Ok(())
    }

    /// Check PDF for encryption dictionaries (/Encrypt)
    pub fn check_pdf_drm(bytes: &[u8]) -> Result<(), ImportError> {
        // Quick byte scan for /Encrypt dictionary indicator
        // PDF specification indicates encrypted documents have /Encrypt entry in the trailer dictionary
        let search_window = if bytes.len() > 1024 * 1024 {
            // Check first 100KB and last 100KB where trailer and catalog reside
            let mut combined = Vec::with_capacity(200 * 1024);
            combined.extend_from_slice(&bytes[..100 * 1024]);
            combined.extend_from_slice(&bytes[bytes.len() - 100 * 1024..]);
            combined
        } else {
            bytes.to_vec()
        };

        if let Ok(text) = std::str::from_utf8(&search_window) {
            if text.contains("/Encrypt") {
                return Err(ImportError::DrmProtected);
            }
        } else {
            // Binary search for ASCII "/Encrypt"
            if search_window.windows(8).any(|w| w == b"/Encrypt") {
                return Err(ImportError::DrmProtected);
            }
        }

        Ok(())
    }

    /// Check MOBI / AZW / AZW3 PalmDOC header for encryption
    pub fn check_mobi_drm(bytes: &[u8]) -> Result<(), ImportError> {
        // Amazon KFX / Topaz check
        if bytes.len() >= 8 {
            if bytes.starts_with(b"\xEA\x4B\x46\x58") || bytes.starts_with(b"TPZ") || bytes.starts_with(b"CONT") {
                return Err(ImportError::DrmProtected);
            }
        }

        if bytes.len() < 86 {
            return Err(ImportError::UnsupportedOrCorrupted("MOBI file header too short".to_string()));
        }

        // Check PDB record count
        let num_records = u16::from_be_bytes([bytes[76], bytes[77]]) as usize;
        if num_records == 0 {
            return Err(ImportError::UnsupportedOrCorrupted("MOBI has zero records".to_string()));
        }

        // Record 0 offset is at byte 78..82
        let record0_offset = u32::from_be_bytes([bytes[78], bytes[79], bytes[80], bytes[81]]) as usize;
        if record0_offset + 14 > bytes.len() {
            return Err(ImportError::UnsupportedOrCorrupted("Invalid MOBI record 0 offset".to_string()));
        }

        // PalmDOC header starts at record0_offset
        // Bytes 12..14 of PalmDOC header is encryption_type (u16 BE):
        // 0 = no encryption (DRM-Free)
        // 1 = Old Mobipocket encryption
        // 2 = Mobipocket DRM encryption
        let encryption_type = u16::from_be_bytes([
            bytes[record0_offset + 12],
            bytes[record0_offset + 13],
        ]);

        if encryption_type != 0 {
            return Err(ImportError::DrmProtected);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_txt_always_drm_free() {
        let text = b"Hello, this is a plain text story.";
        assert!(DrmGuard::check_drm(text, "txt").is_ok());
    }

    #[test]
    fn test_pdf_with_encrypt_flag_is_rejected() {
        let fake_encrypted_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Encrypt 2 0 R >>\nendobj\ntrailer\n<< /Encrypt 2 0 R >>\n%%EOF";
        let res = DrmGuard::check_pdf_drm(fake_encrypted_pdf);
        assert!(matches!(res, Err(ImportError::DrmProtected)));
    }

    #[test]
    fn test_pdf_without_encrypt_flag_passes() {
        let clean_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Size 2 >>\n%%EOF";
        assert!(DrmGuard::check_pdf_drm(clean_pdf).is_ok());
    }

    #[test]
    fn test_mobi_with_encryption_is_rejected() {
        let mut fake_mobi = vec![0u8; 200];
        // Set num_records = 1
        fake_mobi[76] = 0;
        fake_mobi[77] = 1;
        // Record 0 offset = 80
        fake_mobi[78] = 0;
        fake_mobi[79] = 0;
        fake_mobi[80] = 0;
        fake_mobi[81] = 80;
        // At record 0 offset (80) + 12: encryption_type = 2 (DRM)
        fake_mobi[80 + 12] = 0;
        fake_mobi[80 + 13] = 2;

        let res = DrmGuard::check_mobi_drm(&fake_mobi);
        assert!(matches!(res, Err(ImportError::DrmProtected)));
    }

    #[test]
    fn test_mobi_unencrypted_passes() {
        let mut fake_mobi = vec![0u8; 200];
        fake_mobi[76] = 0;
        fake_mobi[77] = 1;
        fake_mobi[78] = 0;
        fake_mobi[79] = 0;
        fake_mobi[80] = 0;
        fake_mobi[81] = 80;
        // encryption_type = 0 (DRM-free)
        fake_mobi[80 + 12] = 0;
        fake_mobi[80 + 13] = 0;

        let res = DrmGuard::check_mobi_drm(&fake_mobi);
        assert!(res.is_ok());
    }
}
