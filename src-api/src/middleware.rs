use axum::{
    extract::{Request, State},
    http::header::AUTHORIZATION,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::{auth, db::AppState, error::AppError};

#[derive(Clone, Debug)]
pub struct AuthUser {
    pub user_id: Uuid,
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing authorization header".to_string()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid authorization header format".to_string()))?;

    let claims = auth::verify_jwt(token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid or expired token".to_string()))?;

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Unauthorized("Invalid user ID in token".to_string()))?;

    let session: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM sessions WHERE token = $1 AND expires_at > NOW()"
    )
    .bind(token)
    .fetch_optional(&state.db)
    .await
    .map_err(|_| AppError::Unauthorized("Session not found".to_string()))?;

    if session.is_none() {
        return Err(AppError::Unauthorized("Session expired or invalid".to_string()));
    }

    request.extensions_mut().insert(AuthUser { user_id });

    Ok(next.run(request).await)
}
