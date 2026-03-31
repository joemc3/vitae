# Phase 2a: Document Pipeline — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Document repository, parsing pipeline, API key management, background job infrastructure
**Builds on:** Phase 1 (auth, database, Docker dev environment)
**Followed by:** Phase 2b (LiteLLM, profile synthesis via SSE, profile editing)

## Overview

Phase 2a establishes the document repository — the core asset of the system. Users upload professional documents (.md, .docx, .pdf, .xlsx, .pptx), which are parsed asynchronously via background jobs and stored for later AI synthesis. This phase also adds encrypted API key storage so users can configure their LLM providers ahead of Phase 2b.

## Architecture Decisions

### Background Jobs: ARQ + Redis

Document parsing runs asynchronously via ARQ (async Redis queue). The API enqueues a parse job on upload and returns immediately. A dedicated worker process picks up the job, parses the file, and updates the database record.

**Why ARQ over Celery:** ARQ is async-native (matches the FastAPI/asyncpg stack), lightweight, and purpose-built for this scale. Celery would work but brings more weight than needed.

**Why not synchronous:** This project doubles as a showcase for agentic development. Background jobs with a proper task queue demonstrate real engineering patterns. The async architecture also handles batch uploads cleanly — 20 documents parse in parallel without blocking the API.

### File Storage: Local Filesystem

Original uploaded files are stored on a Docker volume at `uploads/{user_id}/{document_id}{extension}`. The original filename is preserved in the database, not the filesystem, avoiding collisions and path injection.

**Why not S3/MinIO:** Single-VPS deployment. A Docker volume is simple to back up and avoids infrastructure complexity that doesn't serve the use case.

**File retention:** Originals are kept after parsing. This allows re-downloading and re-parsing with improved logic later. Professional documents are small — storage cost is negligible.

### Encryption: HKDF from SECRET_KEY

API keys are encrypted with AES-256-GCM. The encryption key is derived from the existing `SECRET_KEY` env var using HKDF (SHA-256, info=`"api-key-encryption"`). One root secret, purpose-specific derived keys.

## New Docker Services

### Redis

- Image: `redis:7-alpine`
- Purpose: ARQ job broker
- Added to base services (not dev-only) since the worker depends on it
- Health check: `redis-cli ping`

### Worker

- Image: same `src-api` Dockerfile
- Entrypoint: `uv run arq app.worker.WorkerSettings`
- Mounts the same `uploads` volume as the API
- Depends on: redis (healthy), postgres (healthy)
- Dev profile: mounts source for hot-reload

## Database Changes

### New Table: `documents`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, default uuid4 |
| `user_id` | UUID | FK -> users.id, indexed |
| `filename` | String(255) | Original upload filename |
| `content_type` | String(100) | MIME type (e.g. `application/pdf`) |
| `file_path` | String(500) | Relative path on disk (`{user_id}/{doc_id}{ext}`) |
| `file_size` | Integer | Bytes |
| `parsed_text` | Text | Extracted content, null until parsing completes |
| `status` | String(20) | `processing`, `completed`, `failed` |
| `error_message` | Text | Null unless status is `failed` |
| `created_at` | DateTime(tz) | server_default=now() |
| `updated_at` | DateTime(tz) | auto-updated |

**Relationships:** `User.documents` (one-to-many), `Document.user` (many-to-one).

**Migration:** `002_documents.py` — creates table with index on `user_id`.

### New Table: `api_keys`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK, default uuid4 |
| `user_id` | UUID | FK -> users.id, indexed |
| `provider` | String(50) | `anthropic`, `openai`, `gemini`, `openrouter` |
| `encrypted_key` | LargeBinary | AES-256-GCM ciphertext |
| `nonce` | LargeBinary | 12-byte GCM nonce (unique per encryption) |
| `created_at` | DateTime(tz) | server_default=now() |
| `updated_at` | DateTime(tz) | auto-updated |

**Unique constraint:** `(user_id, provider)` — one key per provider per user. Upsert on save.

**Migration:** `003_api_keys.py` — creates table with unique constraint and index on `user_id`.

## Document Parsing

### Supported Formats

| Format | Library | Extraction strategy |
|--------|---------|-------------------|
| `.md` | `markdown` + `beautifulsoup4` | Render to HTML, strip tags to plain text |
| `.docx` | `python-docx` | Iterate paragraphs + table cells |
| `.pdf` | `pymupdf` (fitz) | Page-by-page text extraction |
| `.xlsx` | `openpyxl` | Iterate sheets -> rows -> cells, tab-separated |
| `.pptx` | `python-pptx` | Iterate slides -> shapes -> text frames |

### Service: `document_parser.py`

A `parse_document(file_path: str, content_type: str) -> str` function that dispatches to the right parser based on content type. Each format gets its own private function (`_parse_pdf`, `_parse_docx`, etc.). Returns extracted plain text.

Pure functions, no class needed. The worker calls `parse_document()`, gets a string, writes it to the DB.

### Validation

- Reject unsupported file types at upload time (before enqueuing) with 415 Unsupported Media Type
- Allowed MIME types mapped to extensions in a constant
- Max file size enforced at the API layer (configurable via `MAX_UPLOAD_SIZE_MB`, default 10MB)

### Error Handling

- If parsing fails (corrupt file, encrypted PDF, etc.), the worker catches the exception, sets `status: "failed"` and `error_message` on the document record
- The original file is kept regardless of parse outcome

## Background Job Infrastructure

### Worker Module: `app/worker.py`

Defines ARQ `WorkerSettings` class and the `parse_document` job function.

### Job Lifecycle

1. API receives upload -> saves file to disk -> creates DB record with `status: "processing"` -> enqueues `parse_document` ARQ job -> returns document response
2. Worker picks up job -> calls `document_parser.parse_document()` -> updates document record with `parsed_text` and `status: "completed"` (or `"failed"` with error message)
3. Frontend polls `GET /api/documents/{id}` to check status

### Configuration

- `REDIS_URL` env var added to `Settings` (default: `redis://redis:6379`)

## REST API Endpoints

### Document Endpoints

Router: `routers/documents.py`, prefix `/api/documents`, all require auth.

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| `POST` | `/` | Multipart file upload (single or multiple) | `201` — list of `DocumentResponse` | Validates type/size, saves, enqueues parse job |
| `GET` | `/` | Query: `status` (optional filter) | `200` — list of `DocumentResponse` | Current user's docs, newest first |
| `GET` | `/{id}` | — | `200` — `DocumentResponse` | Includes `parsed_text` if completed. 404 if not found/not owned |
| `DELETE` | `/{id}` | — | `204` | Deletes DB record + file. 404 if not found/not owned |

### Document Schemas

```python
class DocumentResponse(BaseModel):
    id: str
    filename: str
    content_type: str
    file_size: int
    status: str           # "processing" | "completed" | "failed"
    error_message: str | None
    parsed_text: str | None
    created_at: datetime
    updated_at: datetime
```

### Document Service: `document_service.py`

Business logic between router and database/filesystem:

- `upload_document(db, user_id, file, arq_pool)` — save file, create DB record, enqueue job
- `list_documents(db, user_id, status_filter)` — query with optional filter
- `get_document(db, user_id, doc_id)` — fetch single, enforce ownership
- `delete_document(db, user_id, doc_id)` — delete record + file on disk

Ownership enforced at the service layer — every query filters by `user_id`.

### Settings Endpoints

Router: `routers/settings.py`, prefix `/api/settings`, all require auth.

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| `POST` | `/api-keys` | `{ "provider": "anthropic", "api_key": "sk-..." }` | `201` — `{ "provider": "anthropic", "saved": true }` | Encrypts and upserts |
| `GET` | `/api-keys/{provider}` | — | `200` — `{ "provider": "anthropic", "is_set": true }` | Never returns the actual key |
| `DELETE` | `/api-keys/{provider}` | — | `204` | Removes stored key |
| `POST` | `/test-connection` | `{ "provider": "anthropic" }` | `200` — `{ "provider": ..., "status": "ok" }` | Decrypts key, makes lightweight API call |

**Security:** The GET endpoint never returns decrypted API keys. It only confirms whether a key is stored. Decrypted keys are used only internally (test-connection in 2a, LLM client in 2b).

**test-connection:** Decrypts the stored key and makes a minimal HTTP request to the provider's API to verify the key works. In Phase 2a this is a simple httpx call; in Phase 2b it routes through LiteLLM.

**Ollama note:** Ollama doesn't use an API key — it's configured via `OLLAMA_URL` env var (infrastructure config, not a user credential). It is not stored in the `api_keys` table. The test-connection endpoint accepts `"provider": "ollama"` as a special case and checks whether the configured `OLLAMA_URL` is reachable.

### Encryption Service: `encryption_service.py`

- Derives 256-bit key from `SECRET_KEY` via HKDF (SHA-256, info=`"api-key-encryption"`)
- `encrypt(plaintext: str) -> tuple[bytes, bytes]` — returns (ciphertext, nonce)
- `decrypt(ciphertext: bytes, nonce: bytes) -> str` — returns plaintext

Pure functions, no DB access.

## New Dependencies

### Production

| Package | Purpose |
|---------|---------|
| `arq` | Async Redis job queue |
| `markdown` | Markdown parsing |
| `beautifulsoup4` | HTML tag stripping (for markdown extraction) |
| `python-docx` | .docx parsing |
| `pymupdf` | .pdf parsing |
| `openpyxl` | .xlsx parsing |
| `python-pptx` | .pptx parsing |
| `cryptography` | AES-256-GCM encryption + HKDF key derivation |

### Dev (no new dev dependencies)

Existing `pytest`, `pytest-asyncio`, `httpx`, `testcontainers` cover the testing needs.

## Testing Strategy

### Unit Tests

| Test file | Coverage |
|-----------|----------|
| `test_document_parser.py` | Each parser with real fixture files. Verifies extracted text contains expected content. Tests corrupt/empty files fail gracefully. |
| `test_encryption_service.py` | Encrypt/decrypt round-trip. Different plaintexts produce different nonces. Wrong key fails to decrypt. |
| `test_document_service.py` | Upload validation (file type, size). Mocks DB and filesystem to test orchestration logic. |

### Test Fixtures

`tests/fixtures/` — small sample files for each format. A simple one-page resume in each format containing known text for assertions.

### Integration Tests

| Test file | Coverage |
|-----------|----------|
| `test_document_flow.py` | Upload -> verify `status: "processing"` -> manually run parse -> verify `status: "completed"` + `parsed_text` -> delete -> verify file removed |
| `test_api_keys.py` | Save key -> verify `is_set: true` -> delete -> verify gone. Verify actual key never returned via API. |

### Background Job Testing Approach

Integration tests call the parse function directly (synchronously) rather than spinning up Redis + ARQ. This tests the full parsing pipeline and DB updates without Redis in the test environment. ARQ enqueue/dequeue mechanics are tested as a unit test with mocked Redis.

## Configuration Changes

New env vars added to `Settings`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_URL` | `redis://redis:6379` | ARQ broker URL |
| `MAX_UPLOAD_SIZE_MB` | `10` | Max document upload size |
| `UPLOAD_DIR` | `uploads` | Base directory for file storage |

## File Structure (New Files)

```
src-api/
├── app/
│   ├── models/
│   │   ├── document.py          # Document ORM model
│   │   └── api_key.py           # APIKey ORM model
│   ├── routers/
│   │   ├── documents.py         # Document CRUD endpoints
│   │   └── settings.py          # API key management endpoints
│   ├── schemas/
│   │   ├── documents.py         # DocumentResponse
│   │   └── settings.py          # API key request/response schemas
│   ├── services/
│   │   ├── document_service.py  # Document business logic
│   │   ├── document_parser.py   # Format-specific parsing functions
│   │   └── encryption_service.py # AES-256-GCM encrypt/decrypt
│   └── worker.py                # ARQ worker settings + job functions
├── migrations/versions/
│   ├── 002_documents.py         # Documents table
│   └── 003_api_keys.py          # API keys table
└── tests/
    ├── fixtures/                 # Sample .md, .docx, .pdf, .xlsx, .pptx
    ├── unit/
    │   ├── test_document_parser.py
    │   ├── test_encryption_service.py
    │   └── test_document_service.py
    └── integration/
        ├── test_document_flow.py
        └── test_api_keys.py
```
