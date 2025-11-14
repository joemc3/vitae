use sqlx::{Pool, Postgres};
use std::sync::Arc;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: Pool<Postgres>,
    pub config: Arc<Config>,
}

impl AppState {
    pub fn new(db: Pool<Postgres>, config: Config) -> Self {
        Self {
            db,
            config: Arc::new(config),
        }
    }
}
