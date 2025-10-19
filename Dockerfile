# Multi-stage Dockerfile for Futures Movement Predictor
# Stage 1: Dependencies (cache layer)
FROM node:20-alpine AS deps

# Install tini for proper signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (production + dev for build)
RUN npm ci

# Stage 2: Builder (compile TypeScript and build frontend)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Build frontend (Vite) and backend (esbuild)
# This runs: vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
RUN npm run build

# Stage 3: Runtime (production image)
FROM node:20-alpine AS runtime

# Install tini for proper signal handling
RUN apk add --no-cache tini curl

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built assets from builder
# Vite builds frontend to dist/public, and esbuild bundles server to dist/index.js
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy production dependencies only
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Copy files required for database migrations
COPY --from=builder --chown=nodejs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations

# Set environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    TZ=America/New_York

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Default command (can be overridden in docker-compose)
CMD ["node", "dist/index.js"]
