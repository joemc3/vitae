#!/bin/bash
set -e

# Professional Website Builder - Docker Run Script
# This script starts all services with proper health checks and initialization

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILES="-f docker-compose.yml"
ENV_FILE=".env"

echo -e "${GREEN}Professional Website Builder - Docker Runner${NC}"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo -e "${YELLOW}Please copy .env.example to .env and configure your environment variables:${NC}"
    echo "  cp .env.example .env"
    echo ""
    exit 1
fi

# Parse command line arguments
MODE="production"
DETACH=""
BUILD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            MODE="development"
            COMPOSE_FILES="${COMPOSE_FILES} -f docker-compose.dev.yml"
            shift
            ;;
        --build)
            BUILD="--build"
            shift
            ;;
        --detach|-d)
            DETACH="-d"
            shift
            ;;
        --help|-h)
            echo "Usage: ./docker-run.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev        Run in development mode with hot reload"
            echo "  --build      Force rebuild of images"
            echo "  --detach,-d  Run in detached mode (background)"
            echo "  --help,-h    Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./docker-run.sh                # Run in production mode"
            echo "  ./docker-run.sh --dev          # Run in development mode"
            echo "  ./docker-run.sh --build -d     # Build and run detached"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run './docker-run.sh --help' for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}Mode: ${MODE}${NC}"
echo -e "${BLUE}Compose files: ${COMPOSE_FILES}${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Docker installation
if ! command_exists docker; then
    echo -e "${RED}Error: Docker is not installed!${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}Error: Docker Compose is not installed!${NC}"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

# Use 'docker compose' or 'docker-compose' based on what's available
DOCKER_COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
fi

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
$DOCKER_COMPOSE $COMPOSE_FILES down --remove-orphans || true
echo ""

# Pull latest images (only in production mode without --build)
if [ "$MODE" = "production" ] && [ -z "$BUILD" ]; then
    echo -e "${YELLOW}Pulling latest images...${NC}"
    $DOCKER_COMPOSE $COMPOSE_FILES pull || echo -e "${YELLOW}Warning: Could not pull images. Will use local images.${NC}"
    echo ""
fi

# Build or pull images
if [ -n "$BUILD" ]; then
    echo -e "${YELLOW}Building images...${NC}"
    $DOCKER_COMPOSE $COMPOSE_FILES build
    echo ""
fi

# Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p ./user-data/source-files
mkdir -p ./user-data/generated-site
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Start services
echo -e "${YELLOW}Starting services...${NC}"
if [ -n "$DETACH" ]; then
    $DOCKER_COMPOSE $COMPOSE_FILES up $DETACH $BUILD
    echo ""
    echo -e "${GREEN}Services started in detached mode!${NC}"
else
    echo -e "${BLUE}Starting in attached mode. Press Ctrl+C to stop.${NC}"
    echo ""

    # Trap Ctrl+C and call cleanup function
    trap 'echo ""; echo -e "${YELLOW}Stopping services...${NC}"; $DOCKER_COMPOSE $COMPOSE_FILES down; exit' INT

    $DOCKER_COMPOSE $COMPOSE_FILES up $BUILD
fi

# If running in detached mode, show status and logs info
if [ -n "$DETACH" ]; then
    echo ""
    echo "═════════════════════════════════════════════════════"
    echo -e "${GREEN}Waiting for services to become healthy...${NC}"
    echo ""

    # Wait for services to be healthy
    max_wait=120  # 2 minutes
    elapsed=0
    while [ $elapsed -lt $max_wait ]; do
        if $DOCKER_COMPOSE $COMPOSE_FILES ps | grep -q "healthy"; then
            all_healthy=true

            # Check each service
            for service in postgres api frontend generator; do
                if ! $DOCKER_COMPOSE $COMPOSE_FILES ps $service 2>/dev/null | grep -q "healthy\|running"; then
                    all_healthy=false
                    break
                fi
            done

            if [ "$all_healthy" = true ]; then
                echo -e "${GREEN}✓ All services are healthy!${NC}"
                break
            fi
        fi

        echo -ne "${YELLOW}Waiting... ($elapsed/$max_wait seconds)${NC}\r"
        sleep 5
        elapsed=$((elapsed + 5))
    done

    echo ""
    echo ""

    # Show service status
    echo -e "${BLUE}Service Status:${NC}"
    $DOCKER_COMPOSE $COMPOSE_FILES ps
    echo ""

    # Show access URLs
    echo "═════════════════════════════════════════════════════"
    echo -e "${GREEN}Application is running!${NC}"
    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo "  Frontend:  http://localhost:${FRONTEND_PORT:-80}"
    echo "  API:       http://localhost:${API_PORT:-3001}"
    echo "  Generator: http://localhost:${GENERATOR_PORT:-3002}"

    if [ "$MODE" = "development" ]; then
        echo "  Database:  postgresql://localhost:5432"
        echo "  Adminer:   http://localhost:8080"
    fi

    echo ""
    echo -e "${BLUE}Useful commands:${NC}"
    echo "  View logs:        $DOCKER_COMPOSE $COMPOSE_FILES logs -f"
    echo "  View API logs:    $DOCKER_COMPOSE $COMPOSE_FILES logs -f api"
    echo "  Stop services:    $DOCKER_COMPOSE $COMPOSE_FILES down"
    echo "  Restart service:  $DOCKER_COMPOSE $COMPOSE_FILES restart <service>"
    echo "  Enter container:  $DOCKER_COMPOSE $COMPOSE_FILES exec <service> /bin/sh"
    echo ""
    echo "═════════════════════════════════════════════════════"
fi
