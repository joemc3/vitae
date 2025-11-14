# Professional Website Builder API

REST API backend for the Professional Website Builder application, replacing the Tauri desktop backend with a web-accessible service.

## Features

- **User Authentication**: JWT-based authentication with PostgreSQL session storage
- **Document Processing**: Upload and parse documents (PDF, DOCX, XLSX, PPTX, MD)
- **AI Integration**: Support for multiple LLM providers (Anthropic, OpenAI, Gemini, Local)
- **Encrypted API Key Storage**: AES-256-GCM encryption for secure API key storage
- **Website Generation**: Generate static portfolio websites using Next.js

## Tech Stack

- **Framework**: Axum (Rust web framework)
- **Database**: PostgreSQL with SQLx
- **Authentication**: JWT with bcrypt password hashing
- **Encryption**: AES-256-GCM for API key storage
- **Document Parsing**: comrak, pdf-extract, zip, quick-xml
- **HTTP Client**: reqwest (for LLM API calls)

## Setup

### Prerequisites

- Rust 1.75+
- PostgreSQL 14+
- Node.js 20+ (for website generation)

### Installation

1. **Clone the repository**:
   ```bash
   cd professional-website-builder/src-api
   ```

2. **Set up PostgreSQL**:
   ```bash
   # Using Docker Compose (recommended)
   docker-compose up -d

   # Or install PostgreSQL locally and create database
   createdb professional_website_builder
   psql professional_website_builder < schema.sql
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build and run**:
   ```bash
   cargo build --release
   cargo run --release
   ```

   For development:
   ```bash
   cargo run
   ```

## API Endpoints

### Health Check
- `GET /health` - Service health check

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/logout` - Logout (requires auth)

### File Management
- `POST /api/files/ingest` - Upload and process documents (requires auth)
- `GET /api/files/aggregated-text` - Get aggregated text from all documents (requires auth)

### AI Generation
- `POST /api/ai/generate` - Generate portfolio JSON from documents using AI (requires auth)

### Website Generation
- `POST /api/generate/website` - Generate static website from portfolio JSON (requires auth)

### Settings
- `POST /api/settings/api-keys` - Save API key for LLM provider (requires auth)
- `GET /api/settings/api-keys/:provider` - Get masked API key (requires auth)
- `DELETE /api/settings/api-keys/:provider` - Delete API key (requires auth)
- `POST /api/settings/test-connection` - Test LLM API connection (requires auth)

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Get a token by registering or logging in:

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourpassword"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourpassword"}'
```

## Example Usage

### 1. Upload Documents

```bash
curl -X POST http://localhost:3001/api/files/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@resume.pdf" \
  -F "file=@portfolio.docx"
```

### 2. Generate Portfolio JSON with AI

```bash
curl -X POST http://localhost:3001/api/ai/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider": "anthropic"}'
```

### 3. Generate Website

```bash
curl -X POST http://localhost:3001/api/generate/website \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "json_data": "{...portfolio JSON...}",
    "theme": "onyx"
  }'
```

## Configuration

Key environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT signing (change in production!)
- `ENCRYPTION_KEY`: 32-byte key for API key encryption (change in production!)
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)
- `USER_DATA_DIR`: Directory for user uploaded files and generated sites
- `PROJECT_ROOT`: Root directory of the project (for Next.js generation)

## Security Considerations

1. **Change default secrets**: Update `JWT_SECRET` and `ENCRYPTION_KEY` in production
2. **Use HTTPS**: Always use HTTPS in production
3. **Database security**: Use strong PostgreSQL passwords and restrict network access
4. **API key encryption**: API keys are encrypted with AES-256-GCM before storage
5. **Password hashing**: User passwords are hashed with bcrypt

## Database Schema

See `schema.sql` for the complete database schema. Key tables:

- `users`: User accounts
- `sessions`: JWT session tracking
- `api_keys`: Encrypted LLM API keys
- `documents`: Uploaded and processed documents
- `portfolios`: Generated portfolio data

## Development

### Running Tests

```bash
cargo test
```

### Code Formatting

```bash
cargo fmt
```

### Linting

```bash
cargo clippy
```

## Deployment

### Docker (Recommended)

A Dockerfile can be created for containerized deployment:

```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libpq5 ca-certificates
COPY --from=builder /app/target/release/professional-website-builder-api /usr/local/bin/
CMD ["professional-website-builder-api"]
```

### Environment

Ensure these are set in production:
- Strong `JWT_SECRET`
- Strong `ENCRYPTION_KEY` (exactly 32 bytes)
- Proper `DATABASE_URL` with SSL
- Restrictive `ALLOWED_ORIGINS`

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Test connection
psql -h localhost -U postgres -d professional_website_builder
```

### Build Issues

```bash
# Clean build
cargo clean
cargo build
```

## License

See main project LICENSE file.
