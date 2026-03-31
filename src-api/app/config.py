from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://pwbuser:pwbpass@localhost:5432/professional_website_builder"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # URLs (for generating shareable links)
    site_url: str = "http://localhost:8080"
    admin_url: str = "http://localhost:5173"

    # CORS
    cors_origins: str = ""

    # Logging
    log_level: str = "info"

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()
