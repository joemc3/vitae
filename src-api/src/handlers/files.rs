use axum::{
    extract::{Multipart, State},
    Extension, Json,
};
use serde::Serialize;
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

use crate::{
    db::AppState,
    document_parser,
    error::{AppError, Result},
    middleware::AuthUser,
};

#[derive(Debug, Serialize)]
pub struct IngestResponse {
    pub message: String,
    pub files_processed: usize,
}

#[derive(Debug, Serialize)]
pub struct AggregatedTextResponse {
    pub text: String,
}

pub async fn ingest_files(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<IngestResponse>> {
    let user_dir = PathBuf::from(&state.config.user_data_dir)
        .join(auth_user.user_id.to_string());
    let source_files_dir = user_dir.join("source-files");

    // Create directories if they don't exist
    fs::create_dir_all(&source_files_dir)
        .await
        .map_err(|e| AppError::InternalServerError(format!("Failed to create directories: {}", e)))?;

    let mut files_processed = 0;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to read multipart field: {}", e)))?
    {
        let filename = field
            .file_name()
            .ok_or_else(|| AppError::BadRequest("Missing filename".to_string()))?
            .to_string();

        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::BadRequest(format!("Failed to read file data: {}", e)))?;

        // Save file to disk
        let file_path = source_files_dir.join(&filename);
        fs::write(&file_path, &data)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to write file: {}", e)))?;

        // Parse the document
        let file_path_str = file_path.to_string_lossy().to_string();
        let parse_result = tokio::task::spawn_blocking(move || {
            document_parser::parse_document(&file_path_str)
        })
        .await
        .map_err(|e| AppError::InternalServerError(format!("Task join error: {}", e)))?;

        match parse_result {
            Ok(text) => {
                // Store document in database
                sqlx::query(
                    "INSERT INTO documents (user_id, filename, file_path, aggregated_text, status) VALUES ($1, $2, $3, $4, $5)"
                )
                .bind(auth_user.user_id)
                .bind(&filename)
                .bind(file_path.to_string_lossy().as_ref())
                .bind(&text)
                .bind("success")
                .execute(&state.db)
                .await?;

                files_processed += 1;
            }
            Err(e) => {
                // Store error in database
                sqlx::query(
                    "INSERT INTO documents (user_id, filename, file_path, status, error_message) VALUES ($1, $2, $3, $4, $5)"
                )
                .bind(auth_user.user_id)
                .bind(&filename)
                .bind(file_path.to_string_lossy().as_ref())
                .bind("error")
                .bind(e.to_string())
                .execute(&state.db)
                .await?;

                return Err(AppError::BadRequest(format!(
                    "Failed to parse {}: {}",
                    filename, e
                )));
            }
        }
    }

    Ok(Json(IngestResponse {
        message: "Files ingested successfully".to_string(),
        files_processed,
    }))
}

pub async fn get_aggregated_text(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<AggregatedTextResponse>> {
    // Get all successful documents for this user
    let documents: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT filename, aggregated_text FROM documents WHERE user_id = $1 AND status = 'success' ORDER BY created_at DESC"
    )
    .bind(auth_user.user_id)
    .fetch_all(&state.db)
    .await?;

    if documents.is_empty() {
        return Err(AppError::NotFound(
            "No documents have been ingested yet".to_string(),
        ));
    }

    // Aggregate all text
    let text_parts: Vec<String> = documents
        .iter()
        .filter_map(|(filename, text)| {
            text.as_ref().map(|t| format!("=== {} ===\n{}\n", filename, t))
        })
        .collect();

    Ok(Json(AggregatedTextResponse {
        text: text_parts.join("\n\n"),
    }))
}
