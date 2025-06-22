# Multi-stage Dockerfile for backend service

# Base stage with common dependencies
FROM node:18-alpine AS base
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS development
WORKDIR /app

# Copy source code
COPY packages/backend/src ./packages/backend/src
COPY packages/shared/src ./packages/shared/src
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY tsconfig.json ./

# Install development dependencies
RUN pnpm install --frozen-lockfile

# Expose port
EXPOSE 3000

# Start development server
CMD ["pnpm", "--filter", "backend", "dev"]

# Build stage
FROM base AS build
WORKDIR /app

# Copy source code
COPY packages/backend/src ./packages/backend/src
COPY packages/shared/src ./packages/shared/src
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY tsconfig.json ./

# Build the application
RUN pnpm --filter shared build
RUN pnpm --filter backend build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Change ownership of the app directory
RUN chown -R backend:nodejs /app
USER backend

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start production server
CMD ["node", "packages/backend/dist/server.js"]

# Worker stage for background jobs
FROM production AS worker
WORKDIR /app

# Start worker
CMD ["node", "packages/backend/dist/worker/index.js"]

