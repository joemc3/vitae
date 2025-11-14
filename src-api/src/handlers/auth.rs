use axum::{extract::State, Json};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{auth as auth_utils, db::AppState, error::{AppError, Result}};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate email format
    if !payload.email.contains('@') {
        return Err(AppError::BadRequest("Invalid email format".to_string()));
    }

    // Validate password strength
    if payload.password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".to_string(),
        ));
    }

    // Check if user already exists
    let existing: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await?;

    if existing.is_some() {
        return Err(AppError::BadRequest("Email already registered".to_string()));
    }

    // Hash the password
    let password_hash = auth_utils::hash_password(&payload.password)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    // Create user
    let user: (Uuid, String) = sqlx::query_as(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email"
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .fetch_one(&state.db)
    .await?;

    // Create JWT token
    let token = auth_utils::create_jwt(user.0, &state.config.jwt_secret)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    // Store session in database
    let expires_at = Utc::now() + Duration::hours(24);
    sqlx::query("INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)")
        .bind(user.0)
        .bind(&token)
        .bind(expires_at)
        .execute(&state.db)
        .await?;

    Ok(Json(AuthResponse {
        token: token.clone(),
        user: UserResponse {
            id: user.0.to_string(),
            email: user.1,
        },
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    // Find user by email
    let user: Option<(Uuid, String, String)> = sqlx::query_as(
        "SELECT id, email, password_hash FROM users WHERE email = $1"
    )
    .bind(&payload.email)
    .fetch_optional(&state.db)
    .await?;

    let user = user.ok_or_else(|| AppError::Unauthorized("Invalid email or password".to_string()))?;

    // Verify password
    let is_valid = auth_utils::verify_password(&payload.password, &user.2)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    if !is_valid {
        return Err(AppError::Unauthorized("Invalid email or password".to_string()));
    }

    // Create JWT token
    let token = auth_utils::create_jwt(user.0, &state.config.jwt_secret)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    // Store session in database
    let expires_at = Utc::now() + Duration::hours(24);
    sqlx::query("INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)")
        .bind(user.0)
        .bind(&token)
        .bind(expires_at)
        .execute(&state.db)
        .await?;

    Ok(Json(AuthResponse {
        token: token.clone(),
        user: UserResponse {
            id: user.0.to_string(),
            email: user.1,
        },
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    axum::extract::Extension(auth_user): axum::extract::Extension<crate::middleware::AuthUser>,
) -> Result<Json<Value>> {
    // Delete all sessions for this user
    sqlx::query("DELETE FROM sessions WHERE user_id = $1")
        .bind(auth_user.user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "message": "Logged out successfully" })))
}
