# Docker Quick Start Guide

## TL;DR - Get Running in 3 Minutes

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD at minimum

# 2. Build images
./docker-build.sh

# 3. Start application
./docker-run.sh --detach

# 4. Access application
# Frontend: http://localhost
# API: http://localhost:3001
```

## Essential Commands

### Start/Stop

```bash
# Start (attached mode - see logs)
./docker-run.sh

# Start (detached mode - background)
./docker-run.sh --detach

# Start in development mode (hot reload)
./docker-run.sh --dev

# Stop
docker compose down

# Stop and remove all data (DESTRUCTIVE)
docker compose down -v
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f postgres
docker compose logs -f generator
```

### Status

```bash
# Check all services
docker compose ps

# Check resource usage
docker stats
```

### Rebuilding

```bash
# Rebuild all images
./docker-build.sh

# Rebuild and restart
docker compose up -d --build

# Rebuild specific service
docker compose build api
docker compose up -d api
```

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost | React UI |
| API | http://localhost:3001 | Rust backend |
| Generator | http://localhost:3002 | Next.js generator |
| Database | localhost:5432 | PostgreSQL (not exposed by default) |

## Development Mode Extras

When running with `./docker-run.sh --dev`:

| Service | URL | Description |
|---------|-----|-------------|
| Adminer | http://localhost:8080 | Database UI |
| Vite Dev | http://localhost:5173 | React dev server |

## Troubleshooting

### Port Already in Use

```bash
# Change port in .env
FRONTEND_PORT=8080
API_PORT=3001

# Then restart
docker compose down
docker compose up -d
```

### Database Issues

```bash
# Check database logs
docker compose logs postgres

# Enter database
docker compose exec postgres psql -U pwbuser -d professional_website_builder
```

### Reset Everything

```bash
# DANGER: Deletes all data!
docker compose down -v
./docker-build.sh
./docker-run.sh
```

### Out of Memory

```bash
# Clean up Docker
docker system prune -a

# Increase Docker memory (Docker Desktop)
# Settings → Resources → Memory → 8GB
```

## File Structure

```
professional-website-builder/
├── docker-compose.yml          # Main compose configuration
├── docker-compose.dev.yml      # Development overrides
├── .env                        # Your configuration (create from .env.example)
├── .env.example               # Template with all variables
├── docker-build.sh            # Build all images
├── docker-run.sh              # Start application
├── init-db.sql                # Database initialization
├── DOCKER.md                  # Full documentation
│
├── src-tauri/
│   ├── Dockerfile             # Rust API image
│   └── .dockerignore
│
├── src-ui/
│   ├── Dockerfile             # React frontend image
│   ├── nginx.conf             # Nginx configuration
│   └── .dockerignore
│
└── src-generator/
    ├── Dockerfile             # Next.js generator image
    └── .dockerignore
```

## Environment Variables

**Minimum Required:**
```bash
POSTGRES_PASSWORD=your_secure_password
```

**For LLM Features (at least one):**
```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

**Optional:**
```bash
FRONTEND_PORT=80
API_PORT=3001
GENERATOR_PORT=3002
RUST_LOG=info
```

## Next Steps

1. **Read Full Documentation**: See `DOCKER.md` for complete guide
2. **Configure API Keys**: Add LLM API keys to `.env` for Tier 2 processing
3. **Set Up Backups**: Implement database and volume backups
4. **Configure HTTPS**: Use reverse proxy for production
5. **Monitor Logs**: Set up log aggregation for production

## Support

- Full Documentation: `DOCKER.md`
- Main README: `README.md`
- Development Guide: `DEVELOPMENT.md`
