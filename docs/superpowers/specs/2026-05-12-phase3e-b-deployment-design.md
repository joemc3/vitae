# Phase 3e-B — Deployment Design

**Date:** 2026-05-12
**Status:** Approved (pending user review of this written spec)
**Predecessors:** Phase 3e-A (Polish Features) complete on `main`; Vitae rename complete

## Goal

Ship Vitae to the user's VPS so it can be iterated against by a small invited group. Every push to `main` builds and deploys automatically. Other apps already running on the VPS (da-rag, ollama, crucix, it-tools) must not be affected.

## Non-Goals

The following are deliberately deferred. Each has an entry in `docs/future-work.md` describing why it's deferred and what would trigger picking it up.

- Open public registration (invite codes, email verification, rate limiting)
- Log shipping and metrics dashboards
- Automated nightly backups to remote storage
- Staging environment
- Phase 4 end-to-end browser testing

## Constraints

- **Pangolin/Traefik edge** — the VPS runs `fosrl/pangolin` + `traefik:v3.6` + `fosrl/gerbil`. New services are registered through Pangolin's admin UI; containers don't carry Traefik labels.
- **No exposed host ports** — everything routable goes through the existing `pangolin` Docker network.
- **Containers can't disturb other apps** — Vitae lives in its own compose stack, its own internal network, and its own directory on the VPS.
- **Audience is a small invited group** — registration disabled by default in prod; accounts created via CLI.

## Architecture

### VPS layout

```
/opt/vitae/                           # owned by `deploy` user
├── docker-compose.prod.yml           # synced from repo on every deploy
└── .env                              # 600, generated once during first deploy
```

### Compose services (`docker-compose.prod.yml`)

| Service               | Image                                  | Networks               | Notes |
|-----------------------|----------------------------------------|------------------------|-------|
| `vitae-postgres`      | `postgres:16`                          | `vitae-internal`       | Named volume `vitae-postgres-data` |
| `vitae-redis`         | `redis:7-alpine`                       | `vitae-internal`       | No persistence needed |
| `vitae-api`           | `ghcr.io/joemc3/vitae-api:latest`      | `vitae-internal`, `pangolin` | Command: `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| `vitae-worker`        | `ghcr.io/joemc3/vitae-api:latest`      | `vitae-internal`       | Command: `arq app.worker.WorkerSettings`. Same image as `vitae-api`. Mounts `vitae-output`, `vitae-uploads` |
| `vitae-ui`            | `ghcr.io/joemc3/vitae-ui:latest`       | `pangolin`             | nginx serving the built React SPA |
| `vitae-public-sites`  | `nginx:alpine`                         | `pangolin`             | Mounts `vitae-output` read-only; small config for slug routing |

### Networks

- `pangolin` — declared `external: true, name: pangolin`. Verified to exist on the VPS as a `bridge` network. Only routable services attach.
- `vitae-internal` — bridge, defined in the compose file. Postgres, Redis, and worker live only here. API attaches to both.

### Volumes

- `vitae-postgres-data` — Postgres data
- `vitae-uploads` — user document uploads (worker writes during upload, parser reads)
- `vitae-output` — generated static site output (worker writes, public-sites reads)

### Pangolin resources (created once via Pangolin's admin UI)

| Hostname                       | Path        | Target                  |
|--------------------------------|-------------|-------------------------|
| `app.vitae.2524.cloud`         | `/`         | `vitae-ui:80`           |
| `app.vitae.2524.cloud`         | `/api/*`    | `vitae-api:8000`        |
| `vitae.2524.cloud`             | `/`         | `vitae-public-sites:80` |

Same-host admin (UI + API) means no CORS in prod and a single TLS cert for the admin surface.

## Image Strategy

Two images, both built and pushed to GHCR. Repository `vitae` stays private; images are pulled with a read-only PAT on the VPS.

### `vitae-api`

Single image used by both `vitae-api` and `vitae-worker`. The compose file overrides the command per service.

Multi-stage Dockerfile (`src-api/Dockerfile`, replaces the existing dev-only one):

1. **Python base** — `python:3.13-slim`, install system packages: `nodejs` (20.x), WeasyPrint deps (`libcairo2`, `libpango-1.0-0`, `libpangoft2-1.0-0`, `libjpeg-dev`, etc.), document-parsing deps as needed.
2. **Python deps** — copy `pyproject.toml` + `uv.lock`, install `uv`, run `uv sync --frozen --no-dev`.
3. **Generator deps** — copy `src-generator/package.json` + `package-lock.json`, run `npm ci --omit=dev`. No `next build` — generation invokes `next build` per user at runtime.
4. **Source** — copy `src-api/` and `src-generator/` into the image.

The dev compose continues to use the same Dockerfile, with command/mount overrides and volume-mounted source for hot reload. Single Dockerfile for both modes.

### `vitae-ui`

Multi-stage:
1. `node:20-alpine` — `npm ci && npm run build` (Vite production build)
2. `nginx:alpine` — copy `dist/` to `/usr/share/nginx/html` and a small `nginx.conf` with SPA fallback (`try_files $uri /index.html;`)

### `vitae-public-sites`

No custom image. Uses `nginx:alpine` directly with a config bind-mounted from the compose context (or baked into a `configs:` block). Config routes `/<slug>/` to the corresponding directory under `/usr/share/nginx/html` (the mounted output volume).

### Tagging

Every build pushes two tags per image:
- `ghcr.io/joemc3/vitae-api:sha-<short>` (immutable, for rollback)
- `ghcr.io/joemc3/vitae-api:latest` (moving pointer, what prod compose pulls)

Rollback procedure: `docker pull <sha-tag>` on the VPS, `docker tag <sha-tag> :latest`, `docker compose up -d`. Documented in `docs/deployment.md`.

### Build cache

GHA `docker/build-push-action` uses `cache-from: type=gha, cache-to: type=gha, mode=max` so repeat builds reuse layers.

## Secrets & Environment

### App secrets (`/opt/vitae/.env`, 600, not in git)

| Variable                  | How it's set                            | Purpose |
|---------------------------|-----------------------------------------|---------|
| `POSTGRES_PASSWORD`       | `openssl rand -base64 24` at first deploy | Postgres auth |
| `SECRET_KEY`              | `openssl rand -base64 32` at first deploy | AES-GCM key for stored API keys |
| `JWT_SECRET`              | `openssl rand -base64 32` at first deploy | JWT signing |
| `SITE_URL`                | `https://vitae.2524.cloud`              | Display URLs in generated content |
| `ADMIN_URL`               | `https://app.vitae.2524.cloud`          | CORS origin (unused in same-host setup, kept for parity) |
| `REGISTRATION_ENABLED`    | `false`                                 | Disables `/api/auth/register` |
| `DATABASE_URL`            | Composed from POSTGRES_PASSWORD         | Async asyncpg URL |
| `REDIS_URL`               | `redis://vitae-redis:6379/0`            | ARQ broker |
| `GENERATION_DIR`          | `/data/generation`                      | Worker scratch space |
| `OUTPUT_DIR`              | `/data/output`                          | Worker writes; public-sites serves |

LLM provider keys (`ANTHROPIC_API_KEY`, etc.) are **not** prod env vars. Each user enters their own keys via the admin UI; they're stored AES-GCM encrypted in the `api_keys` table.

### CI secrets (GitHub repo settings → Secrets and variables → Actions)

| Secret         | Purpose |
|----------------|---------|
| `GITHUB_TOKEN` | Built-in; used to push to GHCR (needs `packages: write` in workflow permissions) |
| `VPS_SSH_KEY`  | Private key for the `deploy` user on the VPS |
| `VPS_HOST`     | SSH endpoint of the VPS |
| `VPS_USER`     | `deploy` |

### `deploy` SSH user on the VPS

A dedicated `deploy` user with sudoers entry restricting sudo to exactly the docker compose operations needed:

```
deploy ALL=(root) NOPASSWD: /usr/bin/docker compose -f /opt/vitae/docker-compose.prod.yml *, /usr/bin/docker image prune -f
```

Tighter blast radius than using the human user's account. The compose stack itself still runs as the docker daemon.

## Account Bootstrap

### `REGISTRATION_ENABLED` flag

- Added to `app/config.py` as a `pydantic-settings` field, default `False`.
- `/api/auth/register` reads the flag at request time and returns `403 Forbidden` with a clean error body when disabled.
- Dev compose sets it to `True` so local development is unaffected.
- Prod `.env` sets it to `False`.

### `create_user` CLI

`src-api/app/scripts/create_user.py`. Invocation:

```
docker compose -f /opt/vitae/docker-compose.prod.yml exec vitae-api \
    python -m app.scripts.create_user <email>
```

Behavior:
- Validates email format.
- Prompts for a password (no flag — keeps it out of shell history). Confirms by re-prompting.
- Reuses the bcrypt hashing path in `app.services.auth_service`.
- Inserts via the async session factory. Refuses to overwrite an existing email.
- Prints a single line on success: `Created user <email> (<uuid>)`.

The script will later be the seed for an invite-code issuer when open registration is picked up from `docs/future-work.md`.

## Deploy Flow

### `.github/workflows/deploy.yml`

Triggered on `push: branches: [main]`. Concurrency group `vitae-deploy` with `cancel-in-progress: true`.

#### Job 1 — `build-and-push`

- `ubuntu-latest` runner
- Checkout
- `docker/login-action` → GHCR via `GITHUB_TOKEN`
- `docker/setup-buildx-action`
- Two `docker/build-push-action` steps in parallel:
  - `vitae-api`: context `.`, dockerfile `src-api/Dockerfile`
  - `vitae-ui`: context `src-ui/`, dockerfile `src-ui/Dockerfile`
- Each pushes `:sha-<short>` and `:latest` with `cache-from/to: type=gha, mode=max`
- Outputs the short SHA for job 2

#### Job 2 — `deploy` (needs: build-and-push)

- `ubuntu-latest` runner
- `webfactory/ssh-agent` with `VPS_SSH_KEY`
- `scp` `docker-compose.prod.yml` to `/opt/vitae/` (so compose file edits ship with code)
- `ssh deploy@$VPS_HOST` and run:
  ```
  cd /opt/vitae
  sudo docker compose -f docker-compose.prod.yml pull
  sudo docker compose -f docker-compose.prod.yml up -d --remove-orphans
  sudo docker image prune -f
  ```
- Smoke check from the runner: `curl -fsS https://app.vitae.2524.cloud/api/health` with retries (up to 60s). Fail the workflow if it never returns 200.

### Migrations

Alembic runs on API startup via the existing lifespan hook. `docker compose up -d` triggers migrations transparently. No separate migration step.

### Failure handling

No auto-rollback. Workflow fails loudly; user decides whether to revert the commit, retag a previous SHA back to `:latest`, or roll forward. Auto-rollback is deferred until we have a real need for it.

## First-Deploy Runbook (`docs/deployment.md`)

A one-time procedure documented in `docs/deployment.md`:

1. **DNS** — point `vitae.2524.cloud` and `app.vitae.2524.cloud` at the VPS / Pangolin edge.
2. **Create `deploy` user**, add public key, install sudoers entry.
3. **`mkdir /opt/vitae && chown deploy:deploy /opt/vitae`**, copy initial `docker-compose.prod.yml` from the repo.
4. **Generate `.env`** with `openssl rand` for each secret; `chmod 600`.
5. **`docker login ghcr.io`** on the VPS with a read-only PAT (one-time).
6. **First boot:** `sudo docker compose -f docker-compose.prod.yml up -d`. Watch logs.
7. **Pangolin resources** — create the three resources in the Pangolin admin UI per the table in Architecture.
8. **Smoke checks:** `curl /api/health`, browser-load the admin and public hosts.
9. **Create first account:** `docker compose exec vitae-api python -m app.scripts.create_user joemc3@gmail.com`.
10. **Add GitHub Actions secrets** (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`). Push-to-main deploys from here on.

`docs/deployment.md` also covers:
- Rollback procedure (retag a previous SHA to `:latest` and `up -d`)
- Updating the compose file (lands automatically via deploy job's `scp`)
- Reading logs (`docker compose logs -f` and per-service tailing)
- The manual `make backup` target

## Files Touched

### New
- `docker-compose.prod.yml`
- `.github/workflows/deploy.yml`
- `docs/deployment.md`
- `Makefile` (targets: `backup`, `logs`, `shell`, `migrate`)
- `src-api/app/scripts/__init__.py`
- `src-api/app/scripts/create_user.py`
- `src-api/tests/unit/test_create_user.py`
- `src-api/tests/integration/test_create_user.py`

### Updated
- `src-api/Dockerfile` — rewritten as the multi-stage Python+Node prod-and-dev image
- `src-api/app/config.py` — adds `REGISTRATION_ENABLED`
- `src-api/app/routers/auth.py` — gates `/register` on the flag
- `README.md` — replaces stale Phase 2a status; adds Deployment section linking to `docs/deployment.md`; corrects Python version to 3.13
- `CLAUDE.md` — updates Phase status (3e-B done), env var docs, removes "Node not in worker" gap
- `.env.example` — adds `REGISTRATION_ENABLED=true` (dev default) with a comment about prod
- `docker-compose.yml` — verified to still work after the Dockerfile rewrite; adds `REGISTRATION_ENABLED=true` to api/worker env
- `src-ui/nginx.conf` — already exists; update upstream from `api` to `vitae-api` so the `/api/` proxy block resolves in prod as a backstop (Pangolin handles primary routing)
- `nginx/sites.conf` — already exists; verified against the prod path layout, no changes expected

### Untouched
- `project_standards/*` — legacy PWB-era docs, not load-bearing for this phase

## Testing Strategy

- **Unit tests:** `create_user.py` (input validation, password confirmation, email-exists handling), `REGISTRATION_ENABLED` gate on `/api/auth/register`
- **Integration test:** end-to-end `create_user` invocation against a testcontainer Postgres
- **Manual:** the first-deploy runbook itself is the manual test; smoke checks in the GHA workflow cover steady-state
- **Existing 231-test suite:** must continue passing

## Success Criteria

- Push to `main` from a clean repo deploys to `https://vitae.2524.cloud` and `https://app.vitae.2524.cloud` without manual intervention (after one-time bootstrap).
- `curl https://app.vitae.2524.cloud/api/health` returns 200 from the public internet.
- Logging in as a CLI-created user, uploading a document, synthesizing a profile, and generating a portfolio site all work in prod against the deployed stack.
- Other apps on the VPS (da-rag, ollama, crucix, it-tools) remain healthy throughout.
- `/api/auth/register` returns 403 in prod, 200 in dev.
- README and CLAUDE.md describe the actual deployed system.
