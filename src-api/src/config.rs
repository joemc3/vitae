use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub encryption_key: String,
    pub allowed_origins: String,
    pub user_data_dir: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .context("DATABASE_URL must be set")?,
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "default-secret-change-in-production".to_string()),
            encryption_key: std::env::var("ENCRYPTION_KEY")
                .unwrap_or_else(|_| "default-encryption-key-32-bytes!".to_string()),
            allowed_origins: std::env::var("ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000,http://localhost:5173".to_string()),
            user_data_dir: std::env::var("USER_DATA_DIR")
                .unwrap_or_else(|_| "/app/user-data".to_string()),
        })
    }
}
