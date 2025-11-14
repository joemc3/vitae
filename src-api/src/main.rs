mod auth;
mod config;
mod crypto;
mod db;
mod document_parser;
mod error;
mod handlers;
mod llm_client;
mod middleware;
mod models;
mod types;
mod validator;

use axum::{
    routing::{delete, get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::db::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "professional_website_builder_api=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env()?;

    // Create database connection pool
    tracing::info!("Connecting to database...");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .ok(); // Don't fail if migrations don't exist yet

    // Create app state
    let state = AppState::new(pool, config.clone());

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(true);

    // Build application routes
    let app = Router::new()
        // Health check
        .route("/health", get(handlers::health::health_check))

        // Authentication routes
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/logout", post(handlers::auth::logout))

        // File ingestion routes (protected)
        .route("/api/files/ingest", post(handlers::files::ingest_files))
        .route("/api/files/aggregated-text", get(handlers::files::get_aggregated_text))

        // AI generation routes (protected)
        .route("/api/ai/generate", post(handlers::ai::generate_json))

        // Website generation routes (protected)
        .route("/api/generate/website", post(handlers::generate::generate_website))

        // Settings/API keys routes (protected)
        .route("/api/settings/api-keys", post(handlers::settings::save_api_key))
        .route("/api/settings/api-keys/:provider", get(handlers::settings::get_api_key))
        .route("/api/settings/api-keys/:provider", delete(handlers::settings::delete_api_key))
        .route("/api/settings/test-connection", post(handlers::settings::test_connection))

        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
