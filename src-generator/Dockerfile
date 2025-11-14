# Dockerfile for Next.js generator
FROM node:20-alpine

# Install dependencies for building
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Copy themes and configuration
COPY themes ./themes
COPY next.config.js ./
COPY tsconfig.json ./
COPY tailwind.config.js* ./
COPY postcss.config.js* ./

# Create necessary directories
RUN mkdir -p /app/user-data

# Build the application (pre-build for faster generation)
RUN npm run build

# Expose port (if running as a service)
EXPOSE 3002

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Default command - can be overridden to run builds
CMD ["npm", "run", "start"]
