# Multi-stage Dockerfile for frontend service

# Base stage with common dependencies
FROM node:18-alpine AS base
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS development
WORKDIR /app

# Copy source code
COPY packages/frontend/src ./packages/frontend/src
COPY packages/frontend/public ./packages/frontend/public
COPY packages/shared/src ./packages/shared/src
COPY packages/frontend/tsconfig.json ./packages/frontend/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/frontend/vite.config.ts ./packages/frontend/
COPY tsconfig.json ./

# Install development dependencies
RUN pnpm install --frozen-lockfile

# Expose port
EXPOSE 5173

# Start development server
CMD ["pnpm", "--filter", "frontend", "dev", "--host"]

# Build stage
FROM base AS build
WORKDIR /app

# Copy source code
COPY packages/frontend/src ./packages/frontend/src
COPY packages/frontend/public ./packages/frontend/public
COPY packages/shared/src ./packages/shared/src
COPY packages/frontend/tsconfig.json ./packages/frontend/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/frontend/vite.config.ts ./packages/frontend/
COPY tsconfig.json ./

# Build arguments for environment variables
ARG VITE_GRAPHQL_ENDPOINT
ARG VITE_API_BASE_URL

# Build the application
RUN pnpm --filter shared build
RUN pnpm --filter frontend build

# Production stage with nginx
FROM nginx:alpine AS production

# Copy nginx configuration
COPY packages/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S nginx
RUN adduser -S frontend -u 1001

# Change ownership of nginx directories
RUN chown -R frontend:nginx /var/cache/nginx
RUN chown -R frontend:nginx /var/log/nginx
RUN chown -R frontend:nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid
RUN chown -R frontend:nginx /var/run/nginx.pid

USER frontend

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

