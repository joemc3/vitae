use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{Context, Result};
use base64::{engine::general_purpose, Engine as _};
use rand::Rng;

pub struct Crypto {
    cipher: Aes256Gcm,
}

impl Crypto {
    pub fn new(key: &str) -> Result<Self> {
        // Ensure key is 32 bytes for AES-256
        let key_bytes = if key.len() >= 32 {
            &key.as_bytes()[0..32]
        } else {
            // Pad the key if it's too short
            let mut padded = key.as_bytes().to_vec();
            padded.resize(32, 0);
            return Self::new(&String::from_utf8_lossy(&padded));
        };

        let cipher = Aes256Gcm::new_from_slice(key_bytes)
            .context("Failed to create cipher")?;

        Ok(Self { cipher })
    }

    /// Encrypt a plaintext string
    pub fn encrypt(&self, plaintext: &str) -> Result<(String, String)> {
        // Generate a random nonce
        let nonce_bytes: [u8; 12] = rand::thread_rng().gen();
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt the plaintext
        let ciphertext = self
            .cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Encode to base64
        let encrypted = general_purpose::STANDARD.encode(&ciphertext);
        let nonce_str = general_purpose::STANDARD.encode(&nonce_bytes);

        Ok((encrypted, nonce_str))
    }

    /// Decrypt a ciphertext string
    pub fn decrypt(&self, encrypted: &str, nonce_str: &str) -> Result<String> {
        // Decode from base64
        let ciphertext = general_purpose::STANDARD
            .decode(encrypted)
            .context("Failed to decode ciphertext")?;

        let nonce_bytes = general_purpose::STANDARD
            .decode(nonce_str)
            .context("Failed to decode nonce")?;

        let nonce = Nonce::from_slice(&nonce_bytes);

        // Decrypt
        let plaintext = self
            .cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        String::from_utf8(plaintext).context("Invalid UTF-8 in decrypted data")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption() {
        let crypto = Crypto::new("test-key-that-is-32-bytes-long").unwrap();
        let plaintext = "my-secret-api-key";

        let (encrypted, nonce) = crypto.encrypt(plaintext).unwrap();
        let decrypted = crypto.decrypt(&encrypted, &nonce).unwrap();

        assert_eq!(plaintext, decrypted);
    }
}
