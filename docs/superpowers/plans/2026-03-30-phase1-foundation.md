# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working `docker compose --profile dev up` with Python API serving health check and auth endpoints, connected to PostgreSQL.

**Architecture:** FastAPI + Uvicorn for the API, SQLAlchemy async + Alembic for database, React admin app served by Vite dev server, PostgreSQL for storage. All orchestrated by Docker Compose with a `dev` profile.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, uv, pytest, Docker Compose, PostgreSQL 16, React 18 + Vite

**Spec:** `docs/superpowers/specs/2026-03-30-project-revival-design.md`

---

## File Map

### Files to Delete
- `src-tauri/` (entire directory — deprecated desktop app)
- `src-api/` (entire directory — old Rust API, will be replaced)
- `CONVERSION_SUMMARY.md`
- `WEB_CONVERSION_COMPLETE.md`
- `DOCKER_MIGRATION_COMPLETE.md`
- `RUST_API_IMPLEMENTATION_NOTES.md`
- `IMPLEMENTATION_SUMMARY.md`
- `DEVELOPMENT.md`
- `docker-compose.dev.yml` (replaced by profiles in docker-compose.yml)
- `docker-build.sh` (replaced by docker compose build)
- `docker-run.sh` (replaced by docker compose up)
- `verify-docker-setup.sh` (no longer relevant)
- `generate-icons.sh` (Tauri-specific)
- `clippy.toml` (Rust linter config)
- `init-db.sql` (replaced by Alembic migrations)

### Files to Create (src-api/)
- `src-api/pyproject.toml` — Python project config + dependencies
- `src-api/app/__init__.py` — Package init
- `src-api/app/main.py` — FastAPI app setup, middleware, router includes
- `src-api/app/config.py` — Pydantic settings from environment
- `src-api/app/database.py` — SQLAlchemy async engine + session factory
- `src-api/app/models/__init__.py` — Model exports
- `src-api/app/models/user.py` — User ORM model
- `src-api/app/schemas/__init__.py` — Schema exports
- `src-api/app/schemas/auth.py` — Auth request/response schemas
- `src-api/app/services/__init__.py` — Package init
- `src-api/app/services/auth_service.py` — Registration, login, token logic
- `src-api/app/routers/__init__.py` — Package init
- `src-api/app/routers/auth.py` — Auth HTTP endpoints
- `src-api/app/middleware/__init__.py` — Package init
- `src-api/app/middleware/auth.py` — JWT auth dependency
- `src-api/alembic.ini` — Alembic config
- `src-api/migrations/env.py` — Alembic environment
- `src-api/migrations/script.py.mako` — Migration template
- `src-api/migrations/versions/001_initial_users.py` — Users + sessions table
- `src-api/Dockerfile` — Python API container
- `src-api/tests/__init__.py` — Package init
- `src-api/tests/conftest.py` — Shared test fixtures
- `src-api/tests/unit/__init__.py` — Package init
- `src-api/tests/unit/test_auth_service.py` — Auth service unit tests
- `src-api/tests/integration/__init__.py` — Package init
- `src-api/tests/integration/test_auth_flow.py` — Auth endpoint integration tests

### Files to Create (root)
- `docker-compose.yml` — New compose file with dev profile (replaces old)

### Files to Modify
- `.gitignore` — Add Python patterns, remove Rust patterns
- `.env.example` — Update for new Python API config
- `README.md` — Full rewrite for new architecture
- `CLAUDE.md` — Full rewrite for new architecture

---

### Task 1: Clean Slate — Delete Old Code

**Files:**
- Delete: `src-tauri/` (entire directory)
- Delete: `src-api/` (entire directory)
- Delete: `CONVERSION_SUMMARY.md`, `WEB_CONVERSION_COMPLETE.md`, `DOCKER_MIGRATION_COMPLETE.md`, `RUST_API_IMPLEMENTATION_NOTES.md`, `IMPLEMENTATION_SUMMARY.md`, `DEVELOPMENT.md`
- Delete: `docker-compose.dev.yml`, `docker-build.sh`, `docker-run.sh`, `verify-docker-setup.sh`, `generate-icons.sh`, `clippy.toml`, `init-db.sql`

- [ ] **Step 1: Create feature branch from main**

```bash
git checkout main
git pull origin main
git checkout -b phase1/foundation
```

- [ ] **Step 2: Delete deprecated desktop app**

```bash
rm -rf src-tauri/
git add -A src-tauri/
git commit -m "Delete deprecated Tauri desktop app

The project has fully migrated to a web-based architecture.
Desktop code is no longer maintained or used."
```

- [ ] **Step 3: Delete old Rust API**

```bash
rm -rf src-api/
git add -A src-api/
git commit -m "Delete Rust API (replacing with Python/FastAPI)

The Rust API never successfully ran in containers. Replacing with
Python (FastAPI) for maintainability and faster development."
```

- [ ] **Step 4: Delete stale documentation and scripts**

```bash
rm -f CONVERSION_SUMMARY.md WEB_CONVERSION_COMPLETE.md DOCKER_MIGRATION_COMPLETE.md
rm -f RUST_API_IMPLEMENTATION_NOTES.md IMPLEMENTATION_SUMMARY.md DEVELOPMENT.md
rm -f docker-compose.dev.yml docker-build.sh docker-run.sh
rm -f verify-docker-setup.sh generate-icons.sh clippy.toml init-db.sql
git add -A
git commit -m "Remove stale docs, scripts, and configs

These files reference the old Rust/Tauri architecture and are no longer
accurate. Documentation will be rewritten for the new Python stack."
```

---

### Task 2: Scaffold Python API Project

**Files:**
- Create: `src-api/pyproject.toml`
- Create: `src-api/app/__init__.py`
- Create: `src-api/app/config.py`
- Create: `src-api/app/main.py`

- [ ] **Step 1: Initialize uv project**

```bash
cd src-api
uv init --no-readme
```

This creates a basic `pyproject.toml`. We'll replace its contents in the next step.

- [ ] **Step 2: Write pyproject.toml**

Create `src-api/pyproject.toml`:

```toml
[project]
name = "professional-website-builder-api"
version = "0.1.0"
description = "REST API for Professional Website Builder"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.34.0",
    "sqlalchemy[asyncio]>=2.0.36",
    "asyncpg>=0.30.0",
    "alembic>=1.14.0",
    "pydantic-settings>=2.7.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "python-multipart>=0.0.18",
    "httpx>=0.28.0",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.25.0",
    "httpx>=0.28.0",
    "testcontainers[postgres]>=4.9.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 3: Install dependencies and generate lock file**

```bash
cd src-api
uv sync
```

This creates `uv.lock`. Verify it exists:

```bash
ls -la uv.lock
```

Expected: file exists with non-zero size.

- [ ] **Step 4: Create app package init**

Create `src-api/app/__init__.py`:

```python
```

(Empty file — just marks it as a package.)

- [ ] **Step 5: Write config module**

Create `src-api/app/config.py`:

```python
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
```

- [ ] **Step 6: Write FastAPI app entrypoint**

Create `src-api/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title="Professional Website Builder API",
    version="0.1.0",
)

# CORS
allowed_origins = [settings.admin_url]
if settings.cors_origins:
    allowed_origins.extend(settings.cors_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

- [ ] **Step 7: Verify the app starts**

```bash
cd src-api
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl -s http://localhost:8000/health
kill %1
```

Expected: `{"status":"ok"}`

- [ ] **Step 8: Commit scaffold**

```bash
git add src-api/
git commit -m "Scaffold Python API with FastAPI + uv

- FastAPI app with health check endpoint
- Pydantic settings from environment variables
- CORS middleware configured for admin app origin
- uv for dependency management with locked dependencies"
```

---

### Task 3: Database Setup — SQLAlchemy + Alembic

**Files:**
- Create: `src-api/app/database.py`
- Create: `src-api/app/models/__init__.py`
- Create: `src-api/app/models/user.py`
- Create: `src-api/alembic.ini`
- Create: `src-api/migrations/env.py`
- Create: `src-api/migrations/script.py.mako`
- Create: `src-api/migrations/versions/001_initial_users.py`
- Modify: `src-api/app/main.py` (add DB health check)

- [ ] **Step 1: Write database module**

Create `src-api/app/database.py`:

```python
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.database_url, echo=(settings.log_level == "debug"))
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
```

- [ ] **Step 2: Write User model**

Create `src-api/app/models/__init__.py`:

```python
from app.models.user import Base, User

__all__ = ["Base", "User"]
```

Create `src-api/app/models/user.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 3: Initialize Alembic**

Create `src-api/alembic.ini`:

```ini
[alembic]
script_location = migrations
prepend_sys_path = .

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 4: Write Alembic env.py**

Create `src-api/migrations/__init__.py` (empty file).

Create `src-api/migrations/env.py`:

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.database_url)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 5: Write migration template**

Create `src-api/migrations/script.py.mako`:

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

Create `src-api/migrations/versions/__init__.py` (empty file).

- [ ] **Step 6: Write initial migration**

Create `src-api/migrations/versions/001_initial_users.py`:

```python
"""Create users table

Revision ID: 001
Revises: None
Create Date: 2026-03-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("users")
```

- [ ] **Step 7: Update health check to verify DB connectivity**

Modify `src-api/app/main.py` — replace the health_check function:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory

app = FastAPI(
    title="Professional Website Builder API",
    version="0.1.0",
)

# CORS
allowed_origins = [settings.admin_url]
if settings.cors_origins:
    allowed_origins.extend(settings.cors_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return {"status": "degraded", "database": "disconnected"}
```

- [ ] **Step 8: Commit database setup**

```bash
git add src-api/app/database.py src-api/app/models/ src-api/alembic.ini src-api/migrations/ src-api/app/main.py
git commit -m "Add SQLAlchemy + Alembic database setup

- Async SQLAlchemy engine with asyncpg driver
- User model with UUID primary key and timestamps
- Alembic migrations (initial: users table)
- Health check verifies DB connectivity"
```

---

### Task 4: Auth Service — TDD

**Files:**
- Create: `src-api/app/schemas/__init__.py`
- Create: `src-api/app/schemas/auth.py`
- Create: `src-api/app/services/auth_service.py`
- Create: `src-api/app/middleware/auth.py`
- Create: `src-api/app/routers/auth.py`
- Create: `src-api/tests/__init__.py`
- Create: `src-api/tests/conftest.py`
- Create: `src-api/tests/unit/__init__.py`
- Create: `src-api/tests/unit/test_auth_service.py`
- Create: `src-api/tests/integration/__init__.py`
- Create: `src-api/tests/integration/test_auth_flow.py`
- Modify: `src-api/app/main.py` (include auth router)

- [ ] **Step 1: Write auth Pydantic schemas**

Create `src-api/app/schemas/__init__.py` (empty file).

Create `src-api/app/schemas/auth.py`:

```python
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str

    model_config = {"from_attributes": True}
```

Note: `EmailStr` requires the `email-validator` package. Add it to dependencies.

```bash
cd src-api
uv add email-validator
```

- [ ] **Step 2: Write test fixtures**

Create `src-api/tests/__init__.py` (empty file).

Create `src-api/tests/unit/__init__.py` (empty file).

Create `src-api/tests/integration/__init__.py` (empty file).

Create `src-api/tests/conftest.py`:

```python
import pytest


@pytest.fixture
def sample_user_data():
    return {"email": "test@example.com", "password": "SecurePass123!"}
```

- [ ] **Step 3: Write failing unit tests for auth service**

Create `src-api/tests/unit/test_auth_service.py`:

```python
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.auth_service import AuthService


@pytest.fixture
def auth_service():
    return AuthService(jwt_secret="test-secret", jwt_algorithm="HS256", jwt_expiration_hours=24)


class TestPasswordHashing:
    def test_hash_password_returns_hash(self, auth_service):
        hashed = auth_service.hash_password("mypassword")
        assert hashed != "mypassword"
        assert hashed.startswith("$2b$")

    def test_verify_password_correct(self, auth_service):
        hashed = auth_service.hash_password("mypassword")
        assert auth_service.verify_password("mypassword", hashed) is True

    def test_verify_password_incorrect(self, auth_service):
        hashed = auth_service.hash_password("mypassword")
        assert auth_service.verify_password("wrongpassword", hashed) is False


class TestJWTTokens:
    def test_create_token_returns_string(self, auth_service):
        token = auth_service.create_access_token(user_id="abc-123", email="test@example.com")
        assert isinstance(token, str)
        assert len(token) > 0

    def test_decode_token_returns_payload(self, auth_service):
        token = auth_service.create_access_token(user_id="abc-123", email="test@example.com")
        payload = auth_service.decode_access_token(token)
        assert payload["sub"] == "abc-123"
        assert payload["email"] == "test@example.com"

    def test_decode_invalid_token_returns_none(self, auth_service):
        payload = auth_service.decode_access_token("invalid.token.here")
        assert payload is None

    def test_decode_expired_token_returns_none(self, auth_service):
        svc = AuthService(jwt_secret="test-secret", jwt_algorithm="HS256", jwt_expiration_hours=0)
        token = svc.create_access_token(user_id="abc-123", email="test@example.com")
        # Token with 0 hours expiration is already expired
        payload = svc.decode_access_token(token)
        assert payload is None
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd src-api
uv run pytest tests/unit/test_auth_service.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.auth_service'`

- [ ] **Step 5: Implement auth service**

Create `src-api/app/services/__init__.py` (empty file).

Create `src-api/app/services/auth_service.py`:

```python
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    def __init__(self, jwt_secret: str, jwt_algorithm: str, jwt_expiration_hours: int):
        self.jwt_secret = jwt_secret
        self.jwt_algorithm = jwt_algorithm
        self.jwt_expiration_hours = jwt_expiration_hours

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def create_access_token(self, user_id: str, email: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(hours=self.jwt_expiration_hours)
        payload = {"sub": user_id, "email": email, "exp": expire}
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)

    def decode_access_token(self, token: str) -> dict | None:
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            return payload
        except JWTError:
            return None
```

- [ ] **Step 6: Run unit tests to verify they pass**

```bash
cd src-api
uv run pytest tests/unit/test_auth_service.py -v
```

Expected: All 6 tests PASS.

- [ ] **Step 7: Write auth middleware (JWT dependency)**

Create `src-api/app/middleware/__init__.py` (empty file).

Create `src-api/app/middleware/auth.py`:

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.services.auth_service import AuthService

security = HTTPBearer()

auth_service = AuthService(
    jwt_secret=settings.jwt_secret,
    jwt_algorithm=settings.jwt_algorithm,
    jwt_expiration_hours=settings.jwt_expiration_hours,
)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    payload = auth_service.decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return {"id": payload["sub"], "email": payload["email"]}
```

- [ ] **Step 8: Write auth router**

Create `src-api/app/routers/__init__.py` (empty file).

Create `src-api/app/routers/auth.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import auth_service, get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create user
    user = User(
        email=request.email,
        password_hash=auth_service.hash_password(request.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Return token
    token = auth_service.create_access_token(user_id=str(user.id), email=user.email)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if user is None or not auth_service.verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = auth_service.create_access_token(user_id=str(user.id), email=user.email)
    return TokenResponse(access_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: dict = Depends(get_current_user)):
    # JWT is stateless — client discards the token.
    # This endpoint exists so the frontend has a consistent API to call.
    return None


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(id=current_user["id"], email=current_user["email"])
```

- [ ] **Step 9: Include auth router in main app**

Replace `src-api/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory
from app.routers import auth

app = FastAPI(
    title="Professional Website Builder API",
    version="0.1.0",
)

# CORS
allowed_origins = [settings.admin_url]
if settings.cors_origins:
    allowed_origins.extend(settings.cors_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/health")
async def health_check():
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return {"status": "degraded", "database": "disconnected"}
```

- [ ] **Step 10: Write integration tests for auth flow**

Create `src-api/tests/integration/test_auth_flow.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.main import app
from app.database import get_db
from app.models import Base

# Use testcontainers for a real PostgreSQL instance
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="module")
def postgres_container():
    with PostgresContainer("postgres:16-alpine") as postgres:
        yield postgres


@pytest.fixture(scope="module")
def async_engine(postgres_container):
    url = postgres_container.get_connection_url().replace("psycopg2", "asyncpg")
    return create_async_engine(url)


@pytest.fixture(scope="module")
async def setup_db(async_engine):
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session(async_engine, setup_db):
    session_factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(async_engine, setup_db):
    session_factory = async_sessionmaker(async_engine, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


class TestRegister:
    async def test_register_success(self, client):
        response = await client.post(
            "/api/auth/register",
            json={"email": "new@example.com", "password": "SecurePass123!"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_register_duplicate_email(self, client):
        await client.post(
            "/api/auth/register",
            json={"email": "dupe@example.com", "password": "SecurePass123!"},
        )
        response = await client.post(
            "/api/auth/register",
            json={"email": "dupe@example.com", "password": "SecurePass123!"},
        )
        assert response.status_code == 409

    async def test_register_invalid_email(self, client):
        response = await client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "password": "SecurePass123!"},
        )
        assert response.status_code == 422


class TestLogin:
    async def test_login_success(self, client):
        await client.post(
            "/api/auth/register",
            json={"email": "login@example.com", "password": "SecurePass123!"},
        )
        response = await client.post(
            "/api/auth/login",
            json={"email": "login@example.com", "password": "SecurePass123!"},
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    async def test_login_wrong_password(self, client):
        await client.post(
            "/api/auth/register",
            json={"email": "wrongpw@example.com", "password": "SecurePass123!"},
        )
        response = await client.post(
            "/api/auth/login",
            json={"email": "wrongpw@example.com", "password": "WrongPassword"},
        )
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client):
        response = await client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "SecurePass123!"},
        )
        assert response.status_code == 401


class TestProtectedEndpoints:
    async def test_me_with_valid_token(self, client):
        reg = await client.post(
            "/api/auth/register",
            json={"email": "me@example.com", "password": "SecurePass123!"},
        )
        token = reg.json()["access_token"]
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["email"] == "me@example.com"

    async def test_me_without_token(self, client):
        response = await client.get("/api/auth/me")
        assert response.status_code == 403

    async def test_me_with_invalid_token(self, client):
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401

    async def test_logout(self, client):
        reg = await client.post(
            "/api/auth/register",
            json={"email": "logout@example.com", "password": "SecurePass123!"},
        )
        token = reg.json()["access_token"]
        response = await client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 204
```

- [ ] **Step 11: Run integration tests**

```bash
cd src-api
uv run pytest tests/integration/test_auth_flow.py -v
```

Expected: All tests PASS (requires Docker running for testcontainers).

If Docker is not running, unit tests still pass:

```bash
uv run pytest tests/unit/ -v
```

- [ ] **Step 12: Commit auth implementation**

```bash
git add src-api/app/schemas/ src-api/app/services/ src-api/app/middleware/ src-api/app/routers/ src-api/app/main.py src-api/tests/ src-api/pyproject.toml src-api/uv.lock
git commit -m "Add auth service with register, login, logout (TDD)

- JWT token creation and validation
- bcrypt password hashing
- Register endpoint (409 on duplicate email)
- Login endpoint (401 on bad credentials)
- Logout endpoint (stateless — client discards token)
- /auth/me protected endpoint
- Unit tests for AuthService (password hashing, JWT)
- Integration tests with real PostgreSQL (testcontainers)"
```

---

### Task 5: Docker Compose — Dev Profile

**Files:**
- Create: `src-api/Dockerfile`
- Create: `docker-compose.yml` (replace old)

- [ ] **Step 1: Write Python API Dockerfile**

Create `src-api/Dockerfile`:

```dockerfile
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies first (cached layer)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy application code
COPY app/ app/
COPY migrations/ migrations/
COPY alembic.ini .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Write docker-compose.yml with dev profile**

Create `docker-compose.yml` (replaces the old file):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: professional_website_builder
      POSTGRES_USER: pwbuser
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-pwbpass}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pwbuser -d professional_website_builder"]
      interval: 5s
      timeout: 5s
      retries: 5
    profiles: ["dev", "prod"]
    networks:
      - app-network

  api:
    build:
      context: ./src-api
      dockerfile: Dockerfile
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://pwbuser:${POSTGRES_PASSWORD:-pwbpass}@postgres:5432/professional_website_builder
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      SECRET_KEY: ${SECRET_KEY:-change-me-in-production}
      SITE_URL: ${SITE_URL:-http://localhost:8080}
      ADMIN_URL: ${ADMIN_URL:-http://localhost:5173}
      CORS_ORIGINS: ${CORS_ORIGINS:-}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 10s
      timeout: 5s
      retries: 3
    profiles: ["dev", "prod"]
    networks:
      - app-network

  # --- Dev profile overrides ---

  api-dev:
    extends:
      service: api
    profiles: ["dev"]
    ports:
      - "8000:8000"
    volumes:
      - ./src-api/app:/app/app
      - ./src-api/migrations:/app/migrations
    environment:
      LOG_LEVEL: debug
    command: ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

  postgres-dev:
    extends:
      service: postgres
    profiles: ["dev"]
    ports:
      - "5432:5432"

  frontend-dev:
    build:
      context: ./src-ui
      dockerfile: Dockerfile
      target: dev
    ports:
      - "5173:5173"
    volumes:
      - ./src-ui/src:/app/src
    depends_on:
      api-dev:
        condition: service_healthy
    profiles: ["dev"]
    networks:
      - app-network

volumes:
  postgres-data:

networks:
  app-network:
    driver: bridge
```

Note: The frontend-dev service assumes `src-ui/Dockerfile` has a `dev` target. We'll verify that works in the next step.

- [ ] **Step 3: Check that src-ui has a Dockerfile, add dev target if needed**

Check `src-ui/Dockerfile`. If it doesn't have a `dev` target, create one. The dev target should run `npm run dev` with Vite.

Check current Dockerfile:
```bash
cat src-ui/Dockerfile
```

If no dev target exists, update `src-ui/Dockerfile` to include:

```dockerfile
# Dev stage
FROM node:20-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Production stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 4: Test docker compose dev profile builds**

```bash
docker compose --profile dev build
```

Expected: All services build successfully.

- [ ] **Step 5: Test docker compose dev profile starts**

```bash
docker compose --profile dev up -d
sleep 10
curl -s http://localhost:8000/health
```

Expected: `{"status":"ok","database":"connected"}`

```bash
docker compose --profile dev down
```

- [ ] **Step 6: Commit Docker setup**

```bash
git add src-api/Dockerfile docker-compose.yml
git add src-ui/Dockerfile  # if modified
git commit -m "Add Docker Compose with dev profile

- Python API container (python:3.12-slim + uv)
- PostgreSQL 16 with health checks
- Dev profile: exposed ports, volume mounts, hot reload
- API auto-runs Alembic migrations on startup (TODO: add to entrypoint)
- Frontend dev server with Vite hot reload"
```

---

### Task 6: Alembic Migration on Startup

**Files:**
- Modify: `src-api/app/main.py` (add startup event for migrations)

- [ ] **Step 1: Add startup migration runner**

Add a `lifespan` context manager to `src-api/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory
from app.routers import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run Alembic migrations on startup
    import subprocess
    result = subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        import logging
        logging.getLogger(__name__).error(f"Migration failed: {result.stderr}")
    yield


app = FastAPI(
    title="Professional Website Builder API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
allowed_origins = [settings.admin_url]
if settings.cors_origins:
    allowed_origins.extend(settings.cors_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.get("/health")
async def health_check():
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return {"status": "degraded", "database": "disconnected"}
```

- [ ] **Step 2: Test that migrations run on startup**

```bash
docker compose --profile dev up -d
sleep 10
# Check API logs for migration output
docker compose logs api-dev 2>&1 | head -20
# Verify the users table exists
docker compose exec postgres psql -U pwbuser -d professional_website_builder -c "\dt"
```

Expected: `users` table appears in the table listing.

```bash
docker compose --profile dev down
```

- [ ] **Step 3: Commit**

```bash
git add src-api/app/main.py
git commit -m "Run Alembic migrations automatically on API startup"
```

---

### Task 7: Update .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore for Python stack**

Replace `.gitignore` contents:

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
.venv/
*.egg

# Node
node_modules/
dist/
.next/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker runtime
docker-volumes/
postgres-data/

# Build outputs
*.tgz
*.tar.gz

# Test
.coverage
htmlcov/
.pytest_cache/

# Generated sites (runtime output)
generated-sites/

# Superpowers brainstorm sessions
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "Update .gitignore for Python + Node stack

Remove Rust patterns (target/, Cargo.lock), add Python patterns
(__pycache__, .venv, .pytest_cache), keep Node and Docker patterns."
```

---

### Task 8: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Rewrite .env.example**

Replace `.env.example` contents:

```bash
# =============================================================================
# Professional Website Builder — Environment Configuration
# =============================================================================
# Copy this file to .env and fill in your values.
# Never commit .env to git.

# --- Database ---
POSTGRES_PASSWORD=pwbpass

# --- Security ---
# Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=change-me-generate-a-real-key
JWT_SECRET=change-me-generate-a-real-key

# --- URLs ---
# Where the public portfolio sites are served
SITE_URL=http://localhost:8080
# Where the admin app is served
ADMIN_URL=http://localhost:5173

# --- CORS ---
# Additional allowed origins (comma-separated). ADMIN_URL is always allowed.
CORS_ORIGINS=

# --- LLM API Keys (all optional) ---
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=

# --- Ollama (local or remote) ---
# Default: http://localhost:11434
# For remote: http://ollama.lan:11434 or any network address
OLLAMA_URL=http://localhost:11434

# --- Logging ---
# debug, info, warning, error
LOG_LEVEL=info
```

- [ ] **Step 2: Also update the actual .env file if it exists**

Check if `.env` exists and update it to match the new format. Keep any existing secret values.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "Rewrite .env.example for Python API stack

Remove Rust/Tauri settings. Add SITE_URL, ADMIN_URL, OpenRouter,
configurable Ollama URL. Simplified and documented."
```

---

### Task 9: Rewrite README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write new README.md**

Replace `README.md` with content that accurately reflects the current state of the project. The README should cover:

- What the project does (document repository → portfolio sites + targeted resumes)
- The two separate surfaces (public sites vs admin app)
- Tech stack (Python/FastAPI, React, Next.js, PostgreSQL, Docker)
- Quick start (`docker compose --profile dev up`)
- Project structure
- Environment configuration
- Development workflow
- Current status (Phase 1 — foundation, auth and health check working)

Key rules:
- No references to Rust, Tauri, or the desktop app
- No references to features that don't exist yet (document parsing, LLM integration, themes — these are Phase 2+)
- Be honest about what works NOW vs what's planned
- Include a "Roadmap" section listing the 4 phases

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Rewrite README for new Python/FastAPI architecture

Reflects current state: document repository concept, Python API,
Docker Compose with dev profile. Honest about what works now vs
what's planned in future phases."
```

---

### Task 10: Rewrite CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write new CLAUDE.md**

Rewrite `CLAUDE.md` to accurately reflect the new architecture. Key changes:
- Python API (FastAPI) instead of Rust (Axum)
- New project structure (src-api/ is Python, no src-tauri/)
- New commands (`uv run pytest`, `docker compose --profile dev up`)
- Document repository model instead of single-shot upload
- Two separate surfaces (public sites vs admin app)
- superpowers workflow (specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`)
- TDD as the default approach
- Current phase status

Remove all references to:
- Rust, Cargo, Axum, SQLx
- Tauri, desktop app, IPC commands
- Old shell scripts (docker-build.sh, docker-run.sh, etc.)

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Rewrite CLAUDE.md for Python/FastAPI architecture

New project structure, commands, architecture, and workflow.
References superpowers specs/plans. Removes all Rust/Tauri references."
```

---

### Task 11: End-to-End Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Build and start all services**

```bash
docker compose --profile dev up --build -d
```

Wait for services to be healthy:

```bash
docker compose --profile dev ps
```

Expected: postgres, api-dev, frontend-dev all show "healthy" or "running".

- [ ] **Step 2: Test health check**

```bash
curl -s http://localhost:8000/health | python -m json.tool
```

Expected:
```json
{
    "status": "ok",
    "database": "connected"
}
```

- [ ] **Step 3: Test registration**

```bash
curl -s -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}' | python -m json.tool
```

Expected: 201 response with `access_token`.

- [ ] **Step 4: Test login**

```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}' | python -m json.tool
```

Expected: 200 response with `access_token`.

- [ ] **Step 5: Test protected endpoint**

Using the token from step 4:

```bash
TOKEN="<paste token from step 4>"
curl -s http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

Expected: 200 response with `id` and `email`.

- [ ] **Step 6: Test frontend loads**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

Expected: `200`

- [ ] **Step 7: Clean up**

```bash
docker compose --profile dev down -v
```

- [ ] **Step 8: Run all tests**

```bash
cd src-api
uv run pytest tests/unit/ -v
```

Expected: All unit tests pass.

- [ ] **Step 9: Final commit if any cleanup needed**

If any issues were found and fixed during smoke testing, commit the fixes.

---

## Summary

After completing all 11 tasks, the project will have:
- Clean codebase (no Rust, no Tauri, no stale docs)
- Working Python API with FastAPI + SQLAlchemy + Alembic
- Auth system (register, login, logout, JWT) fully tested via TDD
- Health check with DB connectivity verification
- Docker Compose dev profile with hot reload
- Accurate README.md and CLAUDE.md
- Updated .gitignore and .env.example
- Ready for Phase 2 (document repository + AI pipeline)
