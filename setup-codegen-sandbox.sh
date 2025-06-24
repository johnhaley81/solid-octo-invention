#!/bin/bash

# Codegen Sandbox Setup Script
# Sets up PostgreSQL and pulls latest code with dependencies

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to log messages with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if PostgreSQL service is running
is_postgres_running() {
    sudo service postgresql status | grep -q "online" 2>/dev/null
}

# Function to test database connection
test_db_connection() {
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Testing database connection (attempt $attempt/$max_attempts)..."
        if PGPASSWORD=postgres psql -h localhost -U postgres -d solid_octo_invention -c "SELECT 1;" >/dev/null 2>&1; then
            log "✅ Database connection successful!"
            return 0
        fi
        
        log "❌ Database connection failed, retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done
    
    log "❌ Database connection failed after $max_attempts attempts"
    return 1
}

log "🚀 Setting up Codegen Sandbox"
echo "============================="

# Check if PostgreSQL is already installed
if command -v psql >/dev/null 2>&1; then
    log "📦 PostgreSQL is already installed"
else
    log "📦 Installing PostgreSQL..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib postgresql-client
fi

# Start and enable PostgreSQL service
log "🔧 Starting and enabling PostgreSQL service..."
sudo service postgresql start

# Enable PostgreSQL to start on boot (if systemctl is available)
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable postgresql 2>/dev/null || log "⚠️  Could not enable PostgreSQL service (systemctl not available or failed)"
fi

# Wait a moment for PostgreSQL to fully start
sleep 2

# Verify PostgreSQL is running
if ! is_postgres_running; then
    log "❌ Failed to start PostgreSQL service"
    exit 1
fi

log "✅ PostgreSQL service is running"

# Configure PostgreSQL user password (idempotent)
log "⚙️  Configuring PostgreSQL user..."
if sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" >/dev/null 2>&1; then
    log "✅ PostgreSQL user password configured"
else
    log "❌ Failed to configure PostgreSQL user password"
    exit 1
fi

# Create the database (idempotent)
log "🗄️  Creating database..."
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw solid_octo_invention; then
    log "✅ Database 'solid_octo_invention' already exists"
else
    if sudo -u postgres createdb solid_octo_invention; then
        log "✅ Database 'solid_octo_invention' created"
    else
        log "❌ Failed to create database"
        exit 1
    fi
fi

# Pull latest from main
log "📥 Pulling latest from main..."
cd "$SCRIPT_DIR"
git fetch origin main
git checkout main
git pull origin main

# Copy and configure .env file
log "⚙️  Setting up environment configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    log "✅ Created .env file from .env.example"
else
    log "✅ .env file already exists"
fi

# Ensure DATABASE_URL is correctly set
sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/solid_octo_invention|' .env
log "✅ Database URL configured in .env"

# Install dependencies
log "📦 Installing dependencies..."
if pnpm install; then
    log "✅ Dependencies installed successfully"
else
    log "❌ Failed to install dependencies"
    exit 1
fi

# Test database connection before running migrations
if ! test_db_connection; then
    log "❌ Database connection test failed, cannot proceed with migrations"
    exit 1
fi

# Run migrations
log "🗄️  Running migrations..."
cd "$SCRIPT_DIR/packages/backend/packages/migrate"
if pnpm migrate:up; then
    log "✅ Migrations completed successfully"
else
    log "❌ Failed to run migrations"
    exit 1
fi

# Final connection test
cd "$SCRIPT_DIR"
log "🔍 Performing final database connection test..."
if ! test_db_connection; then
    log "❌ Final database connection test failed"
    exit 1
fi

# Display final status
echo ""
log "✅ Codegen sandbox setup complete!"
echo ""
log "🚀 Ready to develop! Your environment includes:"
log "   - PostgreSQL running on localhost:5432 (service enabled)"
log "   - Database 'solid_octo_invention' created and accessible"
log "   - Latest code from main branch"
log "   - All dependencies installed"
log "   - Database migrations applied"
log "   - Database connection verified"
echo ""
log "🔧 To verify your setup, you can run:"
log "   PGPASSWORD=postgres psql -h localhost -U postgres -d solid_octo_invention -c 'SELECT version();'"
