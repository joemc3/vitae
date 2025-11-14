# Build stage
FROM rust:1.75-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests
COPY Cargo.toml ./

# Create dummy main.rs to build dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY src ./src

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libpq5 \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (needed for Next.js generation)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 appuser

# Create directories
RUN mkdir -p /app/user-data && \
    chown -R appuser:appuser /app

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/professional-website-builder-api /usr/local/bin/

# Copy schema for reference
COPY schema.sql /app/

# Switch to app user
USER appuser

# Expose port
EXPOSE 3001

# Set environment
ENV RUST_LOG=professional_website_builder_api=info

# Run the application
CMD ["professional-website-builder-api"]
