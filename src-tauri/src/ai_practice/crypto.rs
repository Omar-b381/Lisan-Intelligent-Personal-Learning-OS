use sha2::{Digest, Sha256};

const SYSTEM_SALT: &[u8] = b"lisan_ai_practice_secure_salt_v1";

/// Encrypt an API key using a keystream derived from SHA-256 with a unique salt
pub fn encrypt_api_key(raw_key: &str) -> String {
    let trimmed = raw_key.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let input_bytes = trimmed.as_bytes();
    let mut hasher = Sha256::new();
    hasher.update(SYSTEM_SALT);
    hasher.update((input_bytes.len() as u64).to_le_bytes());
    let hash = hasher.finalize();

    // Keystream XOR
    let mut encrypted_bytes = Vec::with_capacity(input_bytes.len());
    for (i, &b) in input_bytes.iter().enumerate() {
        let key_byte = hash[i % hash.len()] ^ ((i as u8).wrapping_mul(31));
        encrypted_bytes.push(b ^ key_byte);
    }

    // Convert to hex
    let mut hex_str = String::with_capacity(encrypted_bytes.len() * 2);
    for b in encrypted_bytes {
        hex_str.push_str(&format!("{:02x}", b));
    }
    hex_str
}

/// Decrypt an API key stored in hex format
pub fn decrypt_api_key(encrypted_hex: &str) -> String {
    let trimmed = encrypted_hex.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // Decode hex
    let mut encrypted_bytes = Vec::new();
    let mut chars = trimmed.chars();
    while let (Some(c1), Some(c2)) = (chars.next(), chars.next()) {
        let byte_str = format!("{}{}", c1, c2);
        if let Ok(b) = u8::from_str_radix(&byte_str, 16) {
            encrypted_bytes.push(b);
        } else {
            return String::new();
        }
    }

    let mut hasher = Sha256::new();
    hasher.update(SYSTEM_SALT);
    hasher.update((encrypted_bytes.len() as u64).to_le_bytes());
    let hash = hasher.finalize();

    let mut decrypted_bytes = Vec::with_capacity(encrypted_bytes.len());
    for (i, &b) in encrypted_bytes.iter().enumerate() {
        let key_byte = hash[i % hash.len()] ^ ((i as u8).wrapping_mul(31));
        decrypted_bytes.push(b ^ key_byte);
    }

    String::from_utf8(decrypted_bytes).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption_roundtrip() {
        let original = "sk-proj-1234567890abcdef-very-long-secret-key-12345";
        let encrypted = encrypt_api_key(original);
        assert_ne!(original, encrypted);
        let decrypted = decrypt_api_key(&encrypted);
        assert_eq!(original, decrypted);
    }

    #[test]
    fn test_empty_key() {
        assert_eq!(encrypt_api_key(""), "");
        assert_eq!(decrypt_api_key(""), "");
    }
}
