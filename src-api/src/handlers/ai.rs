use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    crypto::Crypto,
    db::AppState,
    error::{AppError, Result},
    llm_client::LLMClient,
    middleware::AuthUser,
    types::LLMProvider,
    validator,
};

#[derive(Debug, Deserialize)]
pub struct GenerateRequest {
    pub provider: String,
    pub aggregated_text: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GenerateResponse {
    pub json_data: String,
}

pub async fn generate_json(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<GenerateRequest>,
) -> Result<Json<GenerateResponse>> {
    let provider = LLMProvider::from_string(&payload.provider)
        .map_err(|e| AppError::BadRequest(e))?;

    let text = if let Some(t) = payload.aggregated_text {
        t
    } else {
        let documents: Vec<(String, Option<String>)> = sqlx::query_as(
            "SELECT filename, aggregated_text FROM documents WHERE user_id = $1 AND status = 'success' ORDER BY created_at DESC"
        )
        .bind(auth_user.user_id)
        .fetch_all(&state.db)
        .await?;

        if documents.is_empty() {
            return Err(AppError::NotFound("No documents have been ingested yet".to_string()));
        }

        let text_parts: Vec<String> = documents
            .iter()
            .filter_map(|(filename, text)| {
                text.as_ref().map(|t| format!("=== {} ===\n{}\n", filename, t))
            })
            .collect();

        text_parts.join("\n\n")
    };

    let crypto = Crypto::new(&state.config.encryption_key)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let (api_key, endpoint) = match provider {
        LLMProvider::Local => {
            let key_record: Option<(String, String)> = sqlx::query_as(
                "SELECT encrypted_key, encryption_nonce FROM api_keys WHERE user_id = $1 AND provider = $2"
            )
            .bind(auth_user.user_id)
            .bind("local_endpoint")
            .fetch_optional(&state.db)
            .await?;

            let key_record = key_record.ok_or_else(|| AppError::NotFound("Local LLM endpoint not configured".to_string()))?;

            let endpoint = crypto
                .decrypt(&key_record.0, &key_record.1)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;

            (String::new(), Some(endpoint))
        }
        _ => {
            let key_record: Option<(String, String)> = sqlx::query_as(
                "SELECT encrypted_key, encryption_nonce FROM api_keys WHERE user_id = $1 AND provider = $2"
            )
            .bind(auth_user.user_id)
            .bind(payload.provider.to_lowercase())
            .fetch_optional(&state.db)
            .await?;

            let key_record = key_record.ok_or_else(|| AppError::NotFound(format!("API key for {} not found", payload.provider)))?;

            let api_key = crypto
                .decrypt(&key_record.0, &key_record.1)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;

            (api_key, None)
        }
    };

    let provider_copy = provider;
    let api_key_copy = api_key.clone();
    let text_copy = text.clone();
    let endpoint_copy = endpoint.clone();

    let response = tokio::task::spawn_blocking(move || {
        let client = LLMClient::new();
        client.request_json_generation(
            provider_copy,
            &api_key_copy,
            &text_copy,
            endpoint_copy.as_deref(),
        )
    })
    .await
    .map_err(|e| AppError::InternalServerError(format!("Task join error: {}", e)))?
    .map_err(|e| AppError::InternalServerError(format!("LLM request failed: {}", e)))?;

    let json_str = validator::extract_json_from_response(&response)
        .map_err(|e| AppError::ValidationError(format!("Failed to extract JSON: {}", e)))?;

    validator::validate_portfolio_json(&json_str)
        .map_err(|e| AppError::ValidationError(format!("Invalid portfolio JSON: {}", e)))?;

    Ok(Json(GenerateResponse {
        json_data: json_str,
    }))
}
