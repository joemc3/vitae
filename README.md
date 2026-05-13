# Vitae

Upload your professional documents, get a gorgeous portfolio website and targeted resumes.

## Concept

Vitae uses a **document repository model**: you upload many documents over time — resumes, project write-ups, certifications, bios, anything — and AI synthesizes them into a unified professional profile. From that profile the app can generate:

- **Portfolio sites** — a long-lived personal site that serves as your permanent professional presence
- **Targeted sites** — custom sites tuned for a specific job posting, shareable as a URL
- **Targeted resumes** — PDFs tailored to a specific role, ready to attach to an email

### Two Surfaces

**Public sites** are served separately from the admin app — no login prompt, no nav bar, just gorgeous content at a clean URL.

**Admin app** is where you manage your document repository, run AI synthesis, and kick off site and resume generation.

## Tech Stack

| Layer | Technology |
|-------|------------|
| API | Python 3.13 / FastAPI |
| Admin app | React 18 / Vite |
| Site generator | Next.js 14 |
| Database | PostgreSQL 16 |
| Background jobs | Redis + ARQ |
| Deployment | Docker Compose |

## Document Repository

The core workflow: upload documents, let the system parse and index them, then generate professional outputs.

Supported formats: Markdown, Word (.docx), PDF, Excel (.xlsx), PowerPoint (.pptx).

Uploads return immediately with a job ID. Parsing runs in the background via ARQ + Redis — poll the document endpoint to check status.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your settings
docker compose --profile dev up --build
```

This starts the API, PostgreSQL, Redis, and the ARQ background worker.

- Admin app: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Project Structure

```
├── src-api/          # Python API (FastAPI)
├── src-ui/           # React admin app (Vite)
├── src-generator/    # Next.js site generator
├── docs/             # Design specs and plans
└── docker-compose.yml
```

## Deployment

Vitae deploys to a VPS via push-to-main GitHub Actions. See [`docs/deployment.md`](docs/deployment.md) for the one-time bootstrap procedure and steady-state operations (logs, rollback, backups, user creation).

## Development

### Running Tests

```bash
cd src-api
uv run pytest tests/unit/ -v           # Unit tests
uv run pytest tests/integration/ -v    # Integration tests (needs Docker)
```

## Environment Variables

Copy `.env.example` and fill in the required values. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SECRET_KEY` | Yes | App secret key (32+ characters) |
| `JWT_SECRET` | Yes | JWT signing key (32+ characters) |
| `ANTHROPIC_API_KEY` | No | For Claude AI synthesis |
| `OPENAI_API_KEY` | No | For GPT AI synthesis |

See `.env.example` for the full list.

## Current Status

**Phase 3e-B (Deployment) is complete.** Vitae deploys to a VPS behind Pangolin/Traefik via push-to-main GitHub Actions. Registration is gated behind `REGISTRATION_ENABLED` — small invited group only at launch; public sign-up is tracked in [`docs/future-work.md`](docs/future-work.md).

Prior phases (1, 2a, 2b, 3a–3e-A) are all complete. Phase 4 (end-to-end browser testing) is deliberately deferred.

See `docs/superpowers/specs/` for design specs and `docs/superpowers/plans/` for implementation plans.

## Roadmap

- Phase 1: Foundation ✅
- Phase 2a: Document Repository & Parsing ✅
- Phase 2b: LiteLLM & Profile Synthesis ✅
- Phase 3a: Sites & Generator Wiring ✅
- Phase 3b: Admin UI Rebuild ✅
- Phase 3c: Site Themes ✅
- Phase 3d: Resume PDF Generation ✅
- Phase 3e-A: Polish Features ✅
- Phase 3e-B: Deployment ✅
- Phase 4: End-to-end testing (deferred — see `docs/future-work.md`)

## License

MIT
