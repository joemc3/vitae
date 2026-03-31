# Phase 3a: Sites & Generator Wiring — Design Spec

## Phase 3 Scope

Phase 3 is decomposed into four sub-specs, all required, built in sequence:

1. **Phase 3a: Sites & Generator wiring** — this spec (backend pipeline, no UI)
2. **Phase 3b: Admin UI** — React pages for all Phase 3 features
3. **Phase 3c: Theme design** — 3 public-facing portfolio/targeted site themes
4. **Phase 3d: Resume PDF generation** — backend pipeline + PDF layout

Nothing ships until all four are done. Each sub-spec has its own spec → plan → implementation cycle.

## Overview

This spec covers the backend wiring for site generation: database tables, API endpoints, job posting ingestion (three methods), the generation pipeline from API through ARQ worker to Next.js static output, and the public Nginx serving layer. No admin UI pages or theme design — those are separate sub-specs.

## Architecture

```
Admin UI  →  API  →  ARQ Worker  →  Next.js Generator (subprocess)
                                          │
                                          ▼
                                    Static HTML/CSS/JS
                                          │
                              Public Nginx  ←── serves
```

The API orchestrates. The ARQ worker manages generation jobs. The Next.js generator is a stateless build tool invoked as a subprocess — not a long-running service. Output is static files served by a dedicated public Nginx instance.

## Data Model

### Users (modified)

Add `username` column:
- `String(50)`, unique, indexed
- URL-safe: lowercase alphanumeric + hyphens, must start with a letter, 3–50 characters
- Reserved words blocked: `admin`, `api`, `static`, `health`, `login`, `register`, `settings`
- Nullable initially (existing users set it after migration)
- Used as the public URL namespace: `resume.example.com/{username}`

### Job Postings (new table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users.id, CASCADE delete, indexed |
| `title` | String(255) | Extracted or entered |
| `company` | String(255) | Extracted or entered |
| `description` | Text | Full job description |
| `source_url` | String(2048) | Nullable — original posting URL |
| `raw_text` | Text | Nullable — original pasted/scraped content before LLM parsing |
| `requirements` | JSONB | Nullable — structured extraction from LLM (skills, qualifications, etc.) |
| `created_at` | DateTime | server_default=now() |
| `updated_at` | DateTime | auto-updated |

### Sites (new table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users.id, CASCADE delete, indexed |
| `profile_id` | UUID | FK → profiles.id |
| `job_posting_id` | UUID | FK → job_postings.id, nullable (null for portfolio) |
| `slug` | String(100) | Unique, globally |
| `type` | String(20) | `portfolio` or `targeted` |
| `theme` | String(50) | Theme name used for generation |
| `status` | String(20) | `queued`, `generating`, `ready`, `failed` |
| `error_message` | Text | Nullable — failure reason |
| `output_path` | String(500) | Relative path in output volume |
| `generated_at` | DateTime | Nullable — when build completed |
| `created_at` | DateTime | server_default=now() |
| `updated_at` | DateTime | auto-updated |

Constraints:
- Partial unique index on `user_id` where `type = 'portfolio'` — one portfolio per user (PostgreSQL partial index)
- `slug` globally unique

## Job Posting Ingestion

Three methods, all producing the same structured result that the user can review and edit before saving.

### URL Scraping

`POST /api/job-postings/from-url` with `{ "url": "..." }`

1. API fetches the page using `httpx`
2. Extracts text content using `beautifulsoup4` (already a dependency)
3. Passes extracted text to LLM via LiteLLM to extract structured fields (title, company, description, requirements)
4. Returns a draft job posting (not persisted) for the user to review/edit
5. User saves via `POST /api/job-postings`

Stores the original URL in `source_url` and raw scraped text in `raw_text`.

### Paste-and-Parse

`POST /api/job-postings/from-text` with `{ "raw_text": "..." }`

Same LLM extraction step as URL scraping, skips the fetch. Stores the original text in `raw_text`. Returns draft for review/edit.

### Manual Entry

`POST /api/job-postings` with structured fields directly. Also serves as the "save" endpoint after reviewing a scraped/parsed draft.

### LLM Extraction

Both URL scraping and paste-and-parse use the same LLM extraction service. The prompt asks the model to extract:
- Title
- Company
- Description (cleaned up)
- Requirements (structured: required skills, preferred skills, qualifications, experience level)

Uses the user's configured LLM provider and selected model via the existing LiteLLM integration.

## Site Generation Pipeline

### Portfolio Generation

Triggered by `POST /api/sites/portfolio` with `{ "theme": "theme-name" }`.

1. API creates site record: status `queued`, output path `/output/{username}/`
2. API enqueues ARQ job with site ID
3. Worker picks up job, sets status to `generating`
4. Worker writes input JSON to `/generation/{site_id}/input.json` on shared volume
5. Worker invokes generator: `node /app/generate.js --input /generation/{site_id}/input.json`
6. Generator reads input, applies theme, writes static HTML/CSS/JS to `/output/{username}/index.html` (+ assets)
7. Worker updates site record: status `ready`, sets `generated_at`
8. Worker cleans up `/generation/{site_id}/` input directory

Re-generation overwrites existing files at the same path. Same URL, new content.

### Targeted Site Generation

Triggered by `POST /api/sites/targeted` with `{ "job_posting_id": "...", "theme": "theme-name" }`.

Same pipeline as portfolio, with two additions:
- **Step 3.5**: Worker calls the LLM to produce a tailored profile variant. The LLM receives the base profile + job posting and produces a version with rewritten summary, reordered/filtered experience, and highlighted relevant skills.
- Output path is `/output/{username}/{slug}/index.html`

Targeted sites are immutable snapshots. If the user wants changes, they delete and regenerate (new slug). This prevents content from changing after a link has been shared with a hiring manager.

### Generator Build Contract

**Input JSON** written by worker to `/generation/{site_id}/input.json`:

```json
{
  "site_id": "uuid",
  "type": "portfolio | targeted",
  "theme": "theme-name",
  "profile": { "/* ProfileData object */" },
  "job_posting": { "/* optional, for targeted only */" },
  "output_dir": "/output/joe/abc123"
}
```

**Build command**: `node /app/generate.js --input /generation/{site_id}/input.json`

**Output**: Static HTML/CSS/JS in `output_dir`. `index.html` as entry point, assets alongside.

**Exit codes**: 0 on success, non-zero on failure. Stderr captured by worker for error messages.

The generator is completely stateless — a pure function from input JSON to static files. No database access, no API calls.

### Stale Detection

Portfolio "out of date" nudge: the site record stores `generated_at`, the profile stores `updated_at`. If `profile.updated_at > site.generated_at`, the API includes a `stale: true` flag when returning site info. The admin UI (designed in Phase 3b) will display this as a regeneration prompt.

## API Endpoints

### Job Postings (all protected, JWT required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/job-postings` | Create/save job posting (manual entry or save after review) |
| `POST` | `/api/job-postings/from-url` | Scrape URL → LLM extract → return draft (not persisted) |
| `POST` | `/api/job-postings/from-text` | Parse pasted text → LLM extract → return draft (not persisted) |
| `GET` | `/api/job-postings` | List all job postings for current user |
| `GET` | `/api/job-postings/:id` | Get single job posting |
| `PUT` | `/api/job-postings/:id` | Update job posting |
| `DELETE` | `/api/job-postings/:id` | Delete job posting |

The `from-url` and `from-text` endpoints return a draft shape identical to a saved job posting but not persisted. The client displays it for editing, then calls `POST /api/job-postings` to save.

### Sites (all protected, JWT required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sites/portfolio` | Generate portfolio site (accepts `theme`) |
| `POST` | `/api/sites/targeted` | Generate targeted site (accepts `job_posting_id`, `theme`) |
| `GET` | `/api/sites` | List all sites for current user (includes `stale` flag) |
| `GET` | `/api/sites/:id` | Get site details (status, public URL, generated_at, stale flag) |
| `DELETE` | `/api/sites/:id` | Delete targeted site (removes files + record). Portfolio cannot be deleted, only regenerated. |

### Users (modified)

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/auth/username` | Set/update username (validates URL-safety, uniqueness) |

## Docker & Infrastructure Changes

### New Volumes

- `generation-data` — temporary build I/O, mounted on worker + generator
- `output-data` — final static files, mounted on worker (write) and public Nginx (read)

### Generator Service Changes

The generator is no longer a long-running Docker service. The worker container is extended to include Node.js and the generator source code (multi-stage build or a combined image). The worker invokes the generator as a subprocess (`node /app/generator/generate.js`). This keeps everything in a single container — no cross-container orchestration, no Docker-in-Docker. The worker image grows larger but the operational model is simpler: one process runs Python (ARQ), spawns Node.js subprocesses for builds.

### Public Nginx Service (new)

- Image: `nginx:alpine`
- Serves from `output-data` volume
- Config: `try_files $uri $uri/index.html =404`
- Listens on port 8080 (configurable)
- Routes: `/{username}` → portfolio, `/{username}/{slug}` → targeted site
- No auth, no admin links, no API proxy — purely static file serving
- Dev profile: exposed on `localhost:8080`

### Database Migration

Alembic migration adding:
- `username` column to `users` table (String(50), unique, indexed, nullable)
- `job_postings` table
- `sites` table

## Error Handling

- **Fetch failures** (URL scraping): Return error to client with details (timeout, 404, connection refused). Do not create a job posting record.
- **LLM extraction failures**: Return error to client. User can fall back to manual entry.
- **Generation failures**: Worker sets site status to `failed` with error message from generator stderr. User can retry from the admin UI.
- **File write failures**: Worker sets site status to `failed`. Logs include the underlying OS error.
- **Duplicate portfolio generation**: If a portfolio already exists, re-generation overwrites it. The endpoint is idempotent.

## Testing Strategy

- **Unit tests**: Job posting service (CRUD, validation), site service (creation, status transitions, stale detection), job posting extractor (LLM prompt building, response parsing), generation orchestrator (input JSON assembly)
- **Integration tests**: Full pipeline from API request through ARQ job to file output (using testcontainers for PostgreSQL and Redis). Generator invocation mocked at the subprocess boundary.
- **Contract tests**: Validate the input JSON schema that the generator expects. Validate generator output structure (index.html exists, assets present).
