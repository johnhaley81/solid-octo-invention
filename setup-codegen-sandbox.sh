#!/bin/bash

# Codegen Sandbox Setup Script
# Pulls latest code, installs dependencies, and sets up the development environment

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to log messages with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🚀 Setting up Codegen Sandbox"
echo "============================="

# Pull latest from main
log "📥 Pulling latest from main..."
cd "$SCRIPT_DIR"
git fetch origin main
git checkout main
git pull origin main

# Install dependencies
log "📦 Installing dependencies..."
if pnpm install; then
    log "✅ Dependencies installed successfully"
else
    log "❌ Failed to install dependencies"
    exit 1
fi

# Install Playwright browsers for e2e testing
log "🎭 Installing Playwright browsers..."
if pnpm --filter frontend exec playwright install; then
    log "✅ Playwright browsers installed successfully"
else
    log "❌ Failed to install Playwright browsers"
    exit 1
fi

# Set up database and run migrations
log "🗄️  Setting up database..."
if [ -f "$SCRIPT_DIR/fix-database-issues.sh" ]; then
    chmod +x "$SCRIPT_DIR/fix-database-issues.sh"
    if "$SCRIPT_DIR/fix-database-issues.sh" fix; then
        log "✅ Database setup completed successfully"
    else
        log "❌ Database setup failed"
        echo ""
        log "💡 You can try to fix database issues manually by running:"
        log "   ./fix-database-issues.sh"
        exit 1
    fi
else
    log "⚠️  Database setup script not found, skipping database setup"
    log "💡 Make sure fix-database-issues.sh exists in the project root"
fi

# Display final status
echo ""
log "✅ Codegen sandbox setup complete!"
echo ""
log "🚀 Ready to develop! Your environment includes:"
log "   - Latest code from main branch"
log "   - All dependencies installed"
log "   - PostgreSQL database configured and running"
log "   - Database migrations applied"
log "   - Playwright browsers installed for e2e testing"
echo ""
log "🔧 Useful commands:"
log "   ./fix-database-issues.sh        - Fix any database issues"
log "   ./fix-database-issues.sh test   - Test database connection"
log "   pnpm dev                        - Start development servers"
log "   pnpm test:e2e                   - Run e2e tests (full orchestration)"
log "   ./run-e2e-tests.sh              - Run e2e tests with server management"
echo ""
log "💡 If you encounter database issues, run: ./fix-database-issues.sh"
