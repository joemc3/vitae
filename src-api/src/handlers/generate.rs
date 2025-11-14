use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

use crate::{
    db::AppState,
    error::{AppError, Result},
    middleware::AuthUser,
    validator,
};

#[derive(Debug, Deserialize)]
pub struct GenerateWebsiteRequest {
    pub json_data: String,
    pub theme: String,
}

#[derive(Debug, Serialize)]
pub struct GenerateWebsiteResponse {
    pub message: String,
    pub output_path: String,
}

pub async fn generate_website(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<GenerateWebsiteRequest>,
) -> Result<Json<GenerateWebsiteResponse>> {
    validator::validate_portfolio_json(&payload.json_data)
        .map_err(|e| AppError::ValidationError(format!("Invalid portfolio data: {}", e)))?;

    let user_dir = PathBuf::from(&state.config.user_data_dir)
        .join(auth_user.user_id.to_string());
    let generated_site_dir = user_dir.join("generated-site");

    fs::create_dir_all(&user_dir)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to create directories: {}", e)))?;

    let session_file = user_dir.join("session.json");
    fs::write(&session_file, &payload.json_data)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to write session file: {}", e)))?;

    let json_value: serde_json::Value = serde_json::from_str(&payload.json_data)
        .map_err(|e| AppError::ValidationError(format!("Invalid JSON: {}", e)))?;

    sqlx::query("INSERT INTO portfolios (user_id, json_data, theme) VALUES ($1, $2, $3)")
        .bind(auth_user.user_id)
        .bind(json_value)
        .bind(&payload.theme)
        .execute(&state.db)
        .await?;

    let project_root = std::env::var("PROJECT_ROOT")
        .unwrap_or_else(|_| "/app".to_string());

    let theme = payload.theme.clone();
    let session_file_str = session_file.to_string_lossy().to_string();
    let project_root_clone = project_root.clone();

    let output = tokio::task::spawn_blocking(move || {
        std::process::Command::new("npm")
            .args(&["run", "generator:build"])
            .current_dir(&project_root_clone)
            .env("THEME_NAME", &theme)
            .env("SESSION_FILE", &session_file_str)
            .output()
    })
    .await
    .map_err(|e| AppError::InternalServerError(format!("Task join error: {}", e)))?
    .map_err(|e| AppError::InternalServerError(format!("Failed to run build command: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::InternalServerError(format!("Build failed: {}", stderr)));
    }

    Ok(Json(GenerateWebsiteResponse {
        message: "Website generated successfully".to_string(),
        output_path: generated_site_dir.to_string_lossy().to_string(),
    }))
}
