# syntax=docker/dockerfile:1
#
# Vitae API + worker image.
# Used by both `vitae-api` (uvicorn) and `vitae-worker` (arq) — command differs in compose.
# Contains Python deps for the API and Node + the Next.js generator for site generation.
#
# Build context: repo root.
#   docker build -f src-api/Dockerfile -t vitae-api .

FROM python:3.13-slim

# System deps:
#   - nodejs 20 (for the Next.js generator the worker shells out to)
#   - WeasyPrint runtime libs (Cairo, Pango, GDK, JPEG)
#   - utilities used by the entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates gnupg \
        libcairo2 libpango-1.0-0 libpangoft2-1.0-0 libgdk-pixbuf-2.0-0 \
        libjpeg62-turbo libxml2 libffi8 shared-mime-info fonts-dejavu \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -rf /var/lib/apt/lists/*

# Pinned uv version for reproducible builds
COPY --from=ghcr.io/astral-sh/uv:0.11.14 /uv /usr/local/bin/uv

WORKDIR /app

# Python deps (cached when pyproject.toml + uv.lock don't change)
COPY src-api/pyproject.toml src-api/uv.lock ./
RUN uv sync --frozen --no-dev

# Generator deps (cached when package.json + package-lock.json don't change)
COPY src-generator/package.json src-generator/package-lock.json* ./generator/
RUN cd generator && npm ci --omit=dev

# Application code
COPY src-api/app/ app/
COPY src-api/migrations/ migrations/
COPY src-api/alembic.ini ./

# Generator code (full tree, on top of the already-installed node_modules)
COPY src-generator/ generator/

EXPOSE 8000

# Default command is uvicorn; the worker service overrides this in compose
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
