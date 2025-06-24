#!/bin/bash

# Database Troubleshooting Script for Codegen Sandbox
# Diagnoses and fixes common PostgreSQL connection and migration issues

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
    local database_name="${1:-solid_octo_invention}"
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Testing database connection to '$database_name' (attempt $attempt/$max_attempts)..."
        if PGPASSWORD=postgres psql -h localhost -U postgres -d "$database_name" -c "SELECT 1;" >/dev/null 2>&1; then
            log "✅ Database connection to '$database_name' successful!"
            return 0
        fi
        
        log "❌ Database connection failed, retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done
    
    log "❌ Database connection failed after $max_attempts attempts"
    return 1
}

# Function to check if database exists
database_exists() {
    local database_name="$1"
    sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$database_name"
}

# Function to diagnose PostgreSQL issues
diagnose_postgres() {
    log "🔍 Diagnosing PostgreSQL issues..."
    
    # Check if PostgreSQL is installed
    if ! command -v psql >/dev/null 2>&1; then
        log "❌ PostgreSQL is not installed"
        return 1
    fi
    log "✅ PostgreSQL is installed"
    
    # Check if PostgreSQL service is running
    if ! is_postgres_running; then
        log "❌ PostgreSQL service is not running"
        return 1
    fi
    log "✅ PostgreSQL service is running"
    
    # Check if we can connect to PostgreSQL
    if ! PGPASSWORD=postgres psql -h localhost -U postgres -c "SELECT 1;" >/dev/null 2>&1; then
        log "❌ Cannot connect to PostgreSQL as postgres user"
        return 1
    fi
    log "✅ Can connect to PostgreSQL"
    
    # Check if main database exists
    if ! database_exists "solid_octo_invention"; then
        log "❌ Main database 'solid_octo_invention' does not exist"
        return 1
    fi
    log "✅ Main database 'solid_octo_invention' exists"
    
    # Check if test database exists
    if ! database_exists "solid_octo_invention_test"; then
        log "⚠️  Test database 'solid_octo_invention_test' does not exist"
    else
        log "✅ Test database 'solid_octo_invention_test' exists"
    fi
    
    return 0
}

# Function to fix PostgreSQL installation
fix_postgres_installation() {
    log "🔧 Installing/updating PostgreSQL..."
    
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib postgresql-client
    
    log "✅ PostgreSQL installation completed"
}

# Function to fix PostgreSQL service
fix_postgres_service() {
    log "🔧 Starting and enabling PostgreSQL service..."
    
    # Start the service
    sudo service postgresql start
    
    # Enable on boot if systemctl is available
    if command -v systemctl >/dev/null 2>&1; then
        sudo systemctl enable postgresql 2>/dev/null || log "⚠️  Could not enable PostgreSQL service"
    fi
    
    # Wait for service to fully start
    sleep 3
    
    if is_postgres_running; then
        log "✅ PostgreSQL service is now running"
    else
        log "❌ Failed to start PostgreSQL service"
        return 1
    fi
}

# Function to fix PostgreSQL user configuration
fix_postgres_user() {
    log "🔧 Configuring PostgreSQL user..."
    
    if sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" >/dev/null 2>&1; then
        log "✅ PostgreSQL user password configured"
    else
        log "❌ Failed to configure PostgreSQL user password"
        return 1
    fi
}

# Function to fix database creation
fix_databases() {
    log "🔧 Creating required databases..."
    
    # Create main database
    if database_exists "solid_octo_invention"; then
        log "✅ Main database 'solid_octo_invention' already exists"
    else
        if sudo -u postgres createdb solid_octo_invention; then
            log "✅ Created main database 'solid_octo_invention'"
        else
            log "❌ Failed to create main database"
            return 1
        fi
    fi
    
    # Create test database
    if database_exists "solid_octo_invention_test"; then
        log "✅ Test database 'solid_octo_invention_test' already exists"
    else
        if sudo -u postgres createdb solid_octo_invention_test; then
            log "✅ Created test database 'solid_octo_invention_test'"
        else
            log "⚠️  Failed to create test database (non-critical)"
        fi
    fi
}

# Function to fix environment configuration
fix_env_config() {
    log "🔧 Fixing environment configuration..."
    
    cd "$SCRIPT_DIR"
    
    # Ensure .env file exists
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            log "✅ Created .env file from .env.example"
        else
            log "❌ No .env.example file found"
            return 1
        fi
    else
        log "✅ .env file already exists"
    fi
    
    # Fix DATABASE_URL
    sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/solid_octo_invention|' .env
    log "✅ Database URL configured in .env"
}

# Function to run migrations
fix_migrations() {
    log "🔧 Running database migrations..."
    
    cd "$SCRIPT_DIR"
    
    # Check if migration directory exists
    if [ ! -d "packages/backend/packages/migrate" ]; then
        log "❌ Migration directory not found"
        return 1
    fi
    
    # Test connection before migrations
    if ! test_db_connection "solid_octo_invention"; then
        log "❌ Cannot connect to database for migrations"
        return 1
    fi
    
    # Run migrations
    cd "$SCRIPT_DIR/packages/backend/packages/migrate"
    if pnpm migrate:up; then
        log "✅ Migrations completed successfully"
    else
        log "❌ Failed to run migrations"
        return 1
    fi
    
    cd "$SCRIPT_DIR"
}

# Function to perform comprehensive database fix
fix_all_database_issues() {
    log "🚀 Starting comprehensive database troubleshooting..."
    echo "=============================================="
    
    local issues_found=false
    
    # Diagnose issues first
    if ! diagnose_postgres; then
        issues_found=true
        log "🔧 Issues detected, attempting fixes..."
        
        # Fix PostgreSQL installation
        if ! command -v psql >/dev/null 2>&1; then
            fix_postgres_installation
        fi
        
        # Fix PostgreSQL service
        if ! is_postgres_running; then
            fix_postgres_service
        fi
        
        # Fix PostgreSQL user
        if ! PGPASSWORD=postgres psql -h localhost -U postgres -c "SELECT 1;" >/dev/null 2>&1; then
            fix_postgres_user
        fi
        
        # Fix databases
        if ! database_exists "solid_octo_invention"; then
            fix_databases
        fi
    else
        log "✅ No critical PostgreSQL issues detected"
    fi
    
    # Always check and fix environment configuration
    fix_env_config
    
    # Always attempt to run migrations
    fix_migrations
    
    # Final verification
    log "🔍 Performing final verification..."
    if test_db_connection "solid_octo_invention"; then
        log "✅ Database connection verified successfully"
        
        # Test query to ensure everything works
        if PGPASSWORD=postgres psql -h localhost -U postgres -d solid_octo_invention -c "SELECT version();" >/dev/null 2>&1; then
            log "✅ Database is fully functional"
        else
            log "⚠️  Database connection works but queries may have issues"
        fi
    else
        log "❌ Final database connection test failed"
        return 1
    fi
    
    echo ""
    log "🎉 Database troubleshooting completed successfully!"
    echo ""
    log "📋 Summary of your database setup:"
    log "   - PostgreSQL service: Running and enabled"
    log "   - Main database: solid_octo_invention (accessible)"
    log "   - Test database: solid_octo_invention_test (if created)"
    log "   - Environment: .env configured with correct DATABASE_URL"
    log "   - Migrations: Applied successfully"
    echo ""
    log "🔧 To verify your setup manually, run:"
    log "   PGPASSWORD=postgres psql -h localhost -U postgres -d solid_octo_invention -c 'SELECT version();'"
    echo ""
    
    if [ "$issues_found" = true ]; then
        log "✨ Issues were found and fixed!"
    else
        log "✨ No issues found - your database setup is healthy!"
    fi
}

# Main execution
case "${1:-fix}" in
    "diagnose"|"check")
        log "🔍 Running database diagnostics..."
        if diagnose_postgres; then
            log "✅ All database checks passed!"
        else
            log "❌ Database issues detected. Run '$0 fix' to attempt repairs."
            exit 1
        fi
        ;;
    "fix"|"")
        fix_all_database_issues
        ;;
    "test")
        log "🧪 Testing database connection..."
        if test_db_connection "solid_octo_invention"; then
            log "✅ Database connection test passed!"
        else
            log "❌ Database connection test failed!"
            exit 1
        fi
        ;;
    "help"|"-h"|"--help")
        echo "Database Troubleshooting Script for Codegen Sandbox"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  fix (default)  - Diagnose and fix all database issues"
        echo "  diagnose       - Only diagnose issues without fixing"
        echo "  test          - Test database connection"
        echo "  help          - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0              # Fix all database issues"
        echo "  $0 fix          # Same as above"
        echo "  $0 diagnose     # Only check for issues"
        echo "  $0 test         # Test connection"
        ;;
    *)
        log "❌ Unknown command: $1"
        log "Run '$0 help' for usage information"
        exit 1
        ;;
esac

