# Docker Deployment Guide

This guide provides comprehensive instructions for deploying the Professional Website Builder using Docker and Docker Compose.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Building Images](#building-images)
- [Running the Application](#running-the-application)
- [Development Mode](#development-mode)
- [Production Deployment](#production-deployment)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

## Overview

The application consists of four main services:

1. **PostgreSQL Database** - Stores sessions, files, and user data
2. **Rust API Backend** - Handles file processing, LLM integration, and business logic
3. **React Frontend** - User interface served via Nginx
4. **Next.js Generator** - Generates static portfolio websites

## Prerequisites

- Docker 20.10+ installed ([Installation Guide](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ installed ([Installation Guide](https://docs.docker.com/compose/install/))
- Minimum 4GB RAM available for Docker
- 10GB free disk space for images and volumes

Verify installation:
```bash
docker --version
docker compose version
```

## Quick Start

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd professional-website-builder
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your preferred text editor
   nano .env  # or vim, code, etc.
   ```

3. **Build the images**:
   ```bash
   ./docker-build.sh
   ```

4. **Start the application**:
   ```bash
   ./docker-run.sh --detach
   ```

5. **Access the application**:
   - Frontend: http://localhost
   - API: http://localhost:3001
   - Generator: http://localhost:3002

## Architecture

### Service Dependencies

```
┌─────────────────┐
│    Frontend     │ (Port 80)
│  React + Nginx  │
└────────┬────────┘
         │ Proxies /api to
         ▼
┌─────────────────┐
│    API Server   │ (Port 3001)
│  Rust Backend   │
└────────┬────────┘
         │ Reads/Writes
         ▼
┌─────────────────┐
│   PostgreSQL    │ (Port 5432)
│    Database     │
└─────────────────┘

┌─────────────────┐
│   Generator     │ (Port 3002)
│    Next.js      │
└─────────────────┘
         ▲
         │ Called by API
         │ for website builds
```

### Docker Volumes

- `pwb-postgres-data` - Persistent database storage
- `pwb-user-data` - Shared volume for uploaded files and generated sites

### Docker Network

- `pwb-network` - Bridge network connecting all services

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

#### Required Configuration

```bash
# Database credentials
POSTGRES_PASSWORD=your_secure_password_here

# API Keys (at least one required for Tier 2 processing)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

#### Optional Configuration

```bash
# Custom ports
FRONTEND_PORT=8080
API_PORT=3001
GENERATOR_PORT=3002

# Logging
RUST_LOG=info  # debug, info, warn, error

# Rate limiting
RATE_LIMIT_RPM=60

# File upload limits
MAX_FILE_SIZE_MB=50
```

### Security Best Practices

1. **Never commit .env files** - They contain sensitive credentials
2. **Use strong passwords** - Generate with: `openssl rand -base64 32`
3. **Rotate API keys regularly** - Update in .env and restart services
4. **Run as non-root** - All containers use unprivileged users
5. **Enable HTTPS** - Use a reverse proxy (nginx, Traefik, Caddy) in production

## Building Images

### Build All Images

```bash
./docker-build.sh
```

### Build Specific Version

```bash
./docker-build.sh v1.0.0
```

### Build Individual Services

```bash
# API
docker build -t pwb-api:latest -f src-tauri/Dockerfile src-tauri/

# Frontend
docker build -t pwb-frontend:latest -f src-ui/Dockerfile src-ui/

# Generator
docker build -t pwb-generator:latest -f src-generator/Dockerfile src-generator/
```

### Build Arguments

The Dockerfiles support multi-stage builds for optimization:

- **Builder stage** - Compiles code with all dev dependencies
- **Runtime stage** - Minimal production image with only runtime dependencies

## Running the Application

### Production Mode

Start all services in production mode:

```bash
./docker-run.sh --detach
```

Options:
- `--detach` / `-d` - Run in background
- `--build` - Force rebuild before starting

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f postgres

# Last 100 lines
docker compose logs --tail=100 api
```

### Stop Services

```bash
docker compose down
```

### Stop and Remove Volumes

**WARNING: This deletes all data!**

```bash
docker compose down -v
```

## Development Mode

Development mode enables:
- Hot reload for all services
- Volume mounts for live code changes
- Exposed database port for local tools
- Adminer database UI (http://localhost:8080)
- Debug logging

### Start in Development Mode

```bash
./docker-run.sh --dev
```

Or manually:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Development Workflow

1. Make code changes in your editor
2. Changes are automatically reflected (hot reload)
3. For Rust changes, cargo-watch rebuilds the binary
4. For React changes, Vite hot-reloads the browser
5. For Next.js changes, Next.js rebuilds affected pages

### Access Development Tools

- **Adminer** (Database UI): http://localhost:8080
  - System: PostgreSQL
  - Server: postgres
  - Username: pwbuser
  - Password: (from .env)
  - Database: professional_website_builder

## Production Deployment

### Recommended Production Setup

1. **Use a reverse proxy** (nginx, Traefik, Caddy):
   ```nginx
   server {
       listen 443 ssl http2;
       server_name your-domain.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:80;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

2. **Set up automated backups**:
   ```bash
   # Backup database
   docker compose exec postgres pg_dump -U pwbuser professional_website_builder > backup.sql

   # Backup user data volume
   docker run --rm -v pwb-user-data:/data -v $(pwd):/backup alpine \
       tar czf /backup/user-data-backup.tar.gz /data
   ```

3. **Configure monitoring**:
   - Health checks are built into docker-compose.yml
   - Use monitoring tools like Prometheus + Grafana
   - Set up log aggregation (ELK stack, Loki)

4. **Use Docker secrets** for sensitive data:
   ```yaml
   secrets:
     postgres_password:
       external: true
   ```

### Scaling

Scale specific services:

```bash
# Scale generator for parallel builds
docker compose up -d --scale generator=3
```

### Resource Limits

Add resource constraints in docker-compose.yml:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Monitoring and Maintenance

### Health Checks

All services have built-in health checks:

```bash
# Check service health
docker compose ps

# Inspect specific service health
docker inspect pwb-api | jq '.[0].State.Health'
```

### Resource Usage

```bash
# View resource usage
docker stats

# View container details
docker compose top
```

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
./docker-build.sh
docker compose up -d --build
```

### Database Migrations

```bash
# Run migrations (future feature)
docker compose exec api /app/professional-website-builder migrate

# Or manually connect to database
docker compose exec postgres psql -U pwbuser -d professional_website_builder
```

### Backup and Restore

#### Backup Database

```bash
docker compose exec postgres pg_dump -U pwbuser -d professional_website_builder \
    | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

#### Restore Database

```bash
gunzip -c backup-20250114-120000.sql.gz | \
    docker compose exec -T postgres psql -U pwbuser -d professional_website_builder
```

#### Backup Volumes

```bash
# User data
docker run --rm -v pwb-user-data:/data -v $(pwd):/backup alpine \
    tar czf /backup/user-data-$(date +%Y%m%d).tar.gz /data

# Database volume
docker run --rm -v pwb-postgres-data:/data -v $(pwd):/backup alpine \
    tar czf /backup/postgres-data-$(date +%Y%m%d).tar.gz /data
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error**: `Bind for 0.0.0.0:80 failed: port is already allocated`

**Solution**:
```bash
# Change port in .env
FRONTEND_PORT=8080

# Or stop the conflicting service
sudo lsof -i :80
sudo kill <PID>
```

#### 2. Database Connection Failed

**Error**: `connection refused` or `could not connect to server`

**Solution**:
```bash
# Check database is running
docker compose ps postgres

# View database logs
docker compose logs postgres

# Ensure DATABASE_URL is correct in .env
# Format: postgresql://user:password@postgres:5432/dbname
```

#### 3. Out of Memory

**Error**: Container killed or OOM errors in logs

**Solution**:
```bash
# Increase Docker memory limit (Docker Desktop)
# Settings → Resources → Memory → Increase to 8GB

# Or add memory limits to docker-compose.yml
```

#### 4. Build Failed - Disk Space

**Error**: `no space left on device`

**Solution**:
```bash
# Clean up unused Docker resources
docker system prune -a

# Remove old images
docker image prune -a

# Check disk usage
docker system df
```

#### 5. Permission Denied

**Error**: `permission denied` when accessing files

**Solution**:
```bash
# Fix user-data permissions
sudo chown -R $(id -u):$(id -g) ./user-data/

# Or run with appropriate user
docker compose exec --user root api /bin/sh
```

### Debug Mode

Enable verbose logging:

```bash
# Set in .env
RUST_LOG=debug
DEBUG=true

# Restart services
docker compose restart
```

### Inspect Container

```bash
# Enter running container
docker compose exec api /bin/sh

# Run as root (if needed)
docker compose exec --user root api /bin/sh

# Check environment variables
docker compose exec api env

# Check processes
docker compose exec api ps aux
```

### Network Issues

```bash
# Inspect network
docker network inspect pwb-network

# Test connectivity between containers
docker compose exec frontend ping api
docker compose exec api ping postgres
```

### Reset Everything

**WARNING: Deletes all data!**

```bash
# Stop and remove everything
docker compose down -v --remove-orphans

# Remove all images
docker rmi $(docker images 'professional-website-builder-*' -q)

# Start fresh
./docker-build.sh
./docker-run.sh
```

## Advanced Topics

### Using External Database

To use an external PostgreSQL instance:

1. Comment out `postgres` service in docker-compose.yml
2. Update `DATABASE_URL` in .env to point to external database
3. Manually run `init-db.sql` on the external database

### Custom Themes

Mount custom themes in docker-compose.yml:

```yaml
services:
  generator:
    volumes:
      - ./custom-themes:/app/themes/custom:ro
```

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Build Docker Images

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build images
        run: ./docker-build.sh ${{ github.sha }}
      - name: Push to registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push your-registry/pwb-api:${{ github.sha }}
```

## Support

For issues, questions, or contributions:
- GitHub Issues: [Link to issues]
- Documentation: [Link to docs]
- Community: [Link to discussions]

## License

[Your License Here]
