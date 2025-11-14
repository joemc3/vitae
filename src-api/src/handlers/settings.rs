use axum::{
    extract::{Path, State},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    crypto::Crypto,
    db::AppState,
    error::{AppError, Result},
    llm_client::LLMClient,
    middleware::AuthUser,
    types::LLMProvider,
};

#[derive(Debug, Deserialize)]
pub struct SaveApiKeyRequest {
    pub provider: String,
    pub api_key: String,
}

#[derive(Debug, Serialize)]
pub struct GetApiKeyResponse {
    pub provider: String,
    pub masked_key: String,
}

#[derive(Debug, Deserialize)]
pub struct TestConnectionRequest {
    pub provider: String,
}

pub async fn save_api_key(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<SaveApiKeyRequest>,
) -> Result<Json<Value>> {
    let crypto = Crypto::new(&state.config.encryption_key)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let (encrypted_key, nonce) = crypto
        .encrypt(&payload.api_key)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    sqlx::query(
        "INSERT INTO api_keys (user_id, provider, encrypted_key, encryption_nonce) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, provider) DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, encryption_nonce = EXCLUDED.encryption_nonce, updated_at = CURRENT_TIMESTAMP"
    )
    .bind(auth_user.user_id)
    .bind(payload.provider.to_lowercase())
    .bind(encrypted_key)
    .bind(nonce)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "message": "API key saved successfully" })))
}

pub async fn get_api_key(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(provider): Path<String>,
) -> Result<Json<GetApiKeyResponse>> {
    let key_record: Option<(String, String)> = sqlx::query_as(
        "SELECT encrypted_key, encryption_nonce FROM api_keys WHERE user_id = $1 AND provider = $2"
    )
    .bind(auth_user.user_id)
    .bind(provider.to_lowercase())
    .fetch_optional(&state.db)
    .await?;

    let key_record = key_record.ok_or_else(|| AppError::NotFound("API key not found".to_string()))?;

    let crypto = Crypto::new(&state.config.encryption_key)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let api_key = crypto
        .decrypt(&key_record.0, &key_record.1)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let masked_key = if api_key.len() > 8 {
        format!("{}...{}", &api_key[..4], &api_key[api_key.len() - 4..])
    } else {
        "****".to_string()
    };

    Ok(Json(GetApiKeyResponse {
        provider,
        masked_key,
    }))
}

pub async fn delete_api_key(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(provider): Path<String>,
) -> Result<Json<Value>> {
    sqlx::query("DELETE FROM api_keys WHERE user_id = $1 AND provider = $2")
        .bind(auth_user.user_id)
        .bind(provider.to_lowercase())
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "message": "API key deleted successfully" })))
}

pub async fn test_connection(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<TestConnectionRequest>,
) -> Result<Json<Value>> {
    let provider = LLMProvider::from_string(&payload.provider)
        .map_err(|e| AppError::BadRequest(e))?;

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

            let key_record = key_record.ok_or_else(|| AppError::NotFound("Local endpoint not configured".to_string()))?;

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

            let key_record = key_record.ok_or_else(|| AppError::NotFound("API key not found".to_string()))?;

            let api_key = crypto
                .decrypt(&key_record.0, &key_record.1)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;

            (api_key, None)
        }
    };

    let provider_copy = provider;
    let api_key_copy = api_key.clone();
    let endpoint_copy = endpoint.clone();

    let result = tokio::task::spawn_blocking(move || {
        let client = LLMClient::new();
        client.test_connection(provider_copy, &api_key_copy, endpoint_copy.as_deref())
    })
    .await
    .map_err(|e| AppError::InternalServerError(format!("Task join error: {}", e)))?;

    match result {
        Ok(_) => Ok(Json(json!({
            "success": true,
            "message": "Connection test successful"
        }))),
        Err(e) => Err(AppError::BadRequest(format!("Connection test failed: {}", e))),
    }
}
