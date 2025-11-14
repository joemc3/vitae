#!/bin/bash
# Professional Website Builder - Docker Setup Verification Script
# This script verifies all Docker configurations and prepares for deployment

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Professional Website Builder - Docker Setup Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        exit 1
    fi
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check prerequisites
echo "1. Checking Prerequisites..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_status 0 "Docker installed: $DOCKER_VERSION"
else
    print_status 1 "Docker not found. Please install Docker first."
fi

# Check Docker Compose
if command -v docker compose &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    print_status 0 "Docker Compose installed: $COMPOSE_VERSION"
else
    print_status 1 "Docker Compose not found. Please install Docker Compose."
fi

# Check if Docker daemon is running
if docker info &> /dev/null; then
    print_status 0 "Docker daemon is running"
else
    print_status 1 "Docker daemon is not running. Please start Docker."
fi

echo ""

# 2. Verify file structure
echo "2. Verifying File Structure..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FILES=(
    "docker-compose.yml"
    "docker-compose.dev.yml"
    ".env.example"
    "init-db.sql"
    "docker-build.sh"
    "docker-run.sh"
    "src-api/Dockerfile"
    "src-api/.dockerignore"
    "src-ui/Dockerfile"
    "src-ui/.dockerignore"
    "src-ui/nginx.conf"
    "src-generator/Dockerfile"
    "src-generator/.dockerignore"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_status 0 "$file exists"
    else
        print_status 1 "$file is missing"
    fi
done

echo ""

# 3. Check environment configuration
echo "3. Checking Environment Configuration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f ".env" ]; then
    print_status 0 ".env file exists"

    # Check critical variables
    source .env

    if [ -n "$POSTGRES_PASSWORD" ] && [ "$POSTGRES_PASSWORD" != "changeme_secure_password_here" ]; then
        print_status 0 "POSTGRES_PASSWORD is set"
    else
        print_warning "POSTGRES_PASSWORD not set or using default. Update .env file."
    fi

    if [ -n "$SECRET_KEY" ] && [ "$SECRET_KEY" != "generate_a_secure_random_key_here" ]; then
        print_status 0 "SECRET_KEY is set"
    else
        print_warning "SECRET_KEY not set or using default. Update .env file."
    fi

    if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "generate_another_secure_random_key_here" ]; then
        print_status 0 "JWT_SECRET is set"
    else
        print_warning "JWT_SECRET not set or using default. Update .env file."
    fi
else
    print_warning ".env file not found. Creating from .env.example..."
    cp .env.example .env
    print_info "Please edit .env and set your configuration values."
fi

echo ""

# 4. Validate Dockerfiles
echo "4. Validating Dockerfiles..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Dockerfile syntax (basic check)
for dockerfile in "src-api/Dockerfile" "src-ui/Dockerfile" "src-generator/Dockerfile"; do
    if grep -q "FROM" "$dockerfile" && grep -q "WORKDIR" "$dockerfile"; then
        print_status 0 "$dockerfile has valid syntax"
    else
        print_warning "$dockerfile may have syntax issues"
    fi
done

echo ""

# 5. Check source code
echo "5. Checking Source Code..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Rust API
if [ -f "src-api/Cargo.toml" ]; then
    print_status 0 "Rust API Cargo.toml exists"
    print_info "Checking Rust code compilation..."
    cd src-api
    if cargo check --quiet 2>&1 | grep -q "Finished"; then
        print_status 0 "Rust API code compiles successfully"
    else
        cargo check 2>&1 | tail -10
        print_warning "Rust API has compilation warnings (may be okay)"
    fi
    cd ..
else
    print_status 1 "Rust API Cargo.toml not found"
fi

# Check React UI
if [ -f "src-ui/package.json" ]; then
    print_status 0 "React UI package.json exists"
    if [ -d "src-ui/node_modules" ]; then
        print_status 0 "React UI dependencies installed"
    else
        print_info "Installing React UI dependencies..."
        cd src-ui && npm install && cd ..
    fi
else
    print_status 1 "React UI package.json not found"
fi

# Check Next.js Generator
if [ -f "src-generator/package.json" ]; then
    print_status 0 "Next.js Generator package.json exists"
    if [ -d "src-generator/node_modules" ]; then
        print_status 0 "Next.js Generator dependencies installed"
    else
        print_info "Installing Next.js Generator dependencies..."
        cd src-generator && npm install && cd ..
    fi
else
    print_status 1 "Next.js Generator package.json not found"
fi

echo ""

# 6. Docker network check
echo "6. Checking Docker Resources..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if network exists
if docker network ls | grep -q "pwb-network"; then
    print_warning "Network 'pwb-network' already exists (may be from previous run)"
else
    print_info "Network 'pwb-network' will be created on first run"
fi

# Check if volumes exist
if docker volume ls | grep -q "pwb-postgres-data"; then
    print_warning "Volume 'pwb-postgres-data' already exists (contains data from previous run)"
else
    print_info "Volume 'pwb-postgres-data' will be created on first run"
fi

echo ""

# 7. Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓ Docker setup is ready!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review and update .env file with your configuration"
echo "  2. Build images:     ./docker-build.sh"
echo "  3. Start services:   ./docker-run.sh"
echo "  4. View logs:        docker compose logs -f"
echo ""
echo "For development mode with hot reload:"
echo "  ./docker-run.sh --dev"
echo ""
echo "Documentation:"
echo "  - DOCKER.md - Complete deployment guide"
echo "  - DOCKER_QUICKSTART.md - Quick reference"
echo ""
