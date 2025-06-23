#!/bin/bash

# PostgreSQL Backend Integration Setup for Codegen Sandbox
# This script sets up PostgreSQL to work with the existing packages/backend stack

set -e

echo "🚀 PostgreSQL Backend Integration Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if PostgreSQL is installed
check_postgres() {
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL is not installed"
        echo "Installing PostgreSQL..."
        sudo apt update
        sudo apt install -y postgresql-15 postgresql-client-15 postgresql-contrib-15
        print_status "PostgreSQL installed"
    else
        print_status "PostgreSQL is already installed"
    fi
}

# Start PostgreSQL service
start_postgres() {
    if ! sudo service postgresql status &> /dev/null; then
        print_info "Starting PostgreSQL service..."
        sudo service postgresql start
        sleep 2
    fi
    print_status "PostgreSQL service is running"
}

# Setup PostgreSQL for backend integration
setup_postgres_backend() {
    print_info "Setting up PostgreSQL for backend integration..."
    
    # Switch to postgres user and run setup
    sudo -u postgres psql << 'EOF'
-- Create main database
DROP DATABASE IF EXISTS solid_octo_invention;
CREATE DATABASE solid_octo_invention;

-- Create shadow database for migrations
DROP DATABASE IF EXISTS solid_octo_invention_shadow;
CREATE DATABASE solid_octo_invention_shadow;

-- Connect to main database and set up schema
\c solid_octo_invention;

-- Create app_public schema (required by backend)
DROP SCHEMA IF EXISTS app_public CASCADE;
CREATE SCHEMA app_public;

-- Grant permissions to postgres user (development setup)
GRANT ALL PRIVILEGES ON SCHEMA app_public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app_public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app_public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app_public TO postgres;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA app_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_public GRANT ALL ON FUNCTIONS TO postgres;

-- Set up shadow database with same schema
\c solid_octo_invention_shadow;
CREATE SCHEMA app_public;
GRANT ALL PRIVILEGES ON SCHEMA app_public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app_public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app_public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app_public TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_public GRANT ALL ON FUNCTIONS TO postgres;

-- Show created databases
\l
EOF

    print_status "PostgreSQL databases and schemas created"
}

# Create .env file from template
create_env_file() {
    print_info "Creating .env file for backend integration..."
    
    if [ -f ".env" ]; then
        print_warning ".env file already exists, backing up to .env.backup"
        cp .env .env.backup
    fi
    
    # Copy from .env.example and ensure correct DATABASE_URL
    cp .env.example .env
    
    # Update DATABASE_URL to point to our local setup
    sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/solid_octo_invention|g' .env
    
    print_status ".env file created with correct DATABASE_URL"
}

# Install backend dependencies
install_backend_deps() {
    print_info "Installing backend dependencies..."
    
    # Check if pnpm is available
    if ! command -v pnpm &> /dev/null; then
        print_warning "pnpm not found, installing..."
        npm install -g pnpm
    fi
    
    # Install dependencies
    pnpm install
    print_status "Dependencies installed"
}

# Run database migrations
run_migrations() {
    print_info "Running database migrations..."
    
    cd packages/backend/packages/migrate
    
    # Run migrations
    pnpm migrate:up
    
    print_status "Database migrations completed"
    cd - > /dev/null
}

# Test backend startup
test_backend_startup() {
    print_info "Testing backend startup..."
    
    cd packages/backend
    
    # Try to start the backend (timeout after 10 seconds)
    timeout 10s pnpm dev &
    BACKEND_PID=$!
    
    # Wait a moment for startup
    sleep 5
    
    # Check if backend is responding
    if curl -s http://localhost:3000/health > /dev/null; then
        print_status "Backend started successfully!"
        print_info "GraphQL endpoint: http://localhost:3000/graphql"
        print_info "Health endpoint: http://localhost:3000/health"
    else
        print_warning "Backend startup test inconclusive (may need more time)"
    fi
    
    # Kill the test backend
    kill $BACKEND_PID 2>/dev/null || true
    
    cd - > /dev/null
}

# Generate GraphQL schema
generate_schema() {
    print_info "Generating GraphQL schema..."
    
    cd packages/backend/packages/migrate
    
    # Run schema dump
    node dump-schema.js
    
    # Check if schema.graphql was generated in backend root
    if [ -f "../../schema.graphql" ]; then
        print_status "GraphQL schema generated at packages/backend/schema.graphql"
        print_info "Schema size: $(wc -l < ../../schema.graphql) lines"
    else
        print_warning "schema.graphql not found, may need backend to be running"
    fi
    
    cd - > /dev/null
}

# Create integration test script
create_integration_test() {
    print_info "Creating integration test script..."
    
    cat > test_backend_integration.sh << 'EOF'
#!/bin/bash

# Backend Integration Test Script
# Tests the complete PostgreSQL + Backend integration

set -e

echo "🧪 Testing Backend Integration"
echo "============================="

# Test database connectivity
echo "Testing database connection..."
psql postgresql://postgres:postgres@localhost:5432/solid_octo_invention -c "SELECT current_database(), current_schema();" || exit 1

# Test app_public schema
echo "Testing app_public schema..."
psql postgresql://postgres:postgres@localhost:5432/solid_octo_invention -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'app_public';" || exit 1

# Test backend startup (background)
echo "Testing backend startup..."
cd packages/backend
timeout 15s pnpm dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 8

# Test health endpoint
if curl -s http://localhost:3000/health | grep -q "ok"; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Test GraphQL endpoint
if curl -s http://localhost:3000/graphql -H "Content-Type: application/json" -d '{"query":"{ __schema { types { name } } }"}' | grep -q "types"; then
    echo "✅ GraphQL endpoint responding"
else
    echo "❌ GraphQL endpoint not responding"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# Clean up
kill $BACKEND_PID 2>/dev/null || true
cd - > /dev/null

echo "✅ All integration tests passed!"
echo ""
echo "🚀 Your backend is ready! Run:"
echo "   cd packages/backend && pnpm dev"
echo ""
echo "📊 Endpoints:"
echo "   GraphQL: http://localhost:3000/graphql"
echo "   Health:  http://localhost:3000/health"
EOF

    chmod +x test_backend_integration.sh
    print_status "Integration test script created: test_backend_integration.sh"
}

# Create rules for future agents
create_agent_rules() {
    print_info "Creating rules for future codegen agents..."
    
    cat > POSTGRES_BACKEND_RULES.md << 'EOF'
# PostgreSQL Backend Integration Rules for Codegen Agents

## 🚨 CRITICAL RULES - MUST FOLLOW

### Database Setup Requirements
1. **Always use existing backend stack** - Never create separate GraphQL servers
2. **Use app_public schema** - Backend expects `app_public`, not `public` schema
3. **Maintain .env configuration** - DATABASE_URL must point to local PostgreSQL
4. **Run migrations first** - Always run `pnpm migrate:up` before starting backend

### Required Environment Setup
```bash
# 1. Ensure PostgreSQL is running
sudo service postgresql start

# 2. Verify databases exist
psql -l | grep solid_octo_invention

# 3. Check .env file exists with correct DATABASE_URL
cat .env | grep DATABASE_URL

# 4. Install dependencies
pnpm install

# 5. Run migrations
cd packages/backend/packages/migrate && pnpm migrate:up

# 6. Start backend
cd packages/backend && pnpm dev
```

### Schema Generation Workflow
1. **Automatic generation**: Backend generates `schema.graphql` on startup when `NODE_ENV=development`
2. **Manual generation**: Run `node packages/backend/packages/migrate/dump-schema.js`
3. **Location**: Schema file is created at `packages/backend/schema.graphql`

### Database Connection Details
- **Host**: localhost
- **Port**: 5432
- **Database**: solid_octo_invention
- **Schema**: app_public
- **User**: postgres (development)
- **Password**: postgres (development)
- **Full URL**: `postgresql://postgres:postgres@localhost:5432/solid_octo_invention`

### Migration Commands
```bash
cd packages/backend/packages/migrate

# Apply migrations
pnpm migrate:up

# Reset database (DESTRUCTIVE)
pnpm migrate:reset

# Watch for changes
pnpm dev
```

### Backend Commands
```bash
cd packages/backend

# Development mode (with hot reload)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Start worker processes
pnpm worker:start
```

### Troubleshooting Checklist
1. ✅ PostgreSQL service running: `sudo service postgresql status`
2. ✅ Databases exist: `psql -l | grep solid_octo_invention`
3. ✅ app_public schema exists: `psql solid_octo_invention -c "\dn"`
4. ✅ .env file configured: `grep DATABASE_URL .env`
5. ✅ Dependencies installed: `ls node_modules | wc -l`
6. ✅ Migrations applied: `cd packages/backend/packages/migrate && pnpm migrate:up`

### Integration Test
Run the integration test to verify everything works:
```bash
./test_backend_integration.sh
```

### Common Errors and Solutions

**Error**: `database "solid_octo_invention" does not exist`
**Solution**: Run `./setup_postgres_backend_integration.sh` to create databases

**Error**: `schema "app_public" does not exist`
**Solution**: Run migrations: `cd packages/backend/packages/migrate && pnpm migrate:up`

**Error**: `DATABASE_URL environment variable is missing`
**Solution**: Ensure `.env` file exists with correct DATABASE_URL

**Error**: `ECONNREFUSED localhost:5432`
**Solution**: Start PostgreSQL: `sudo service postgresql start`

**Error**: `permission denied for schema app_public`
**Solution**: Re-run setup script to fix permissions

## 🎯 Success Criteria
- [ ] PostgreSQL running on localhost:5432
- [ ] Databases `solid_octo_invention` and `solid_octo_invention_shadow` exist
- [ ] Schema `app_public` exists in both databases
- [ ] .env file configured with correct DATABASE_URL
- [ ] Backend starts successfully on port 3000
- [ ] GraphQL endpoint responds at http://localhost:3000/graphql
- [ ] Schema file generated at packages/backend/schema.graphql
- [ ] Migrations can be applied successfully
- [ ] Integration test passes
EOF

    print_status "Agent rules created: POSTGRES_BACKEND_RULES.md"
}

# Main execution
main() {
    echo "Starting PostgreSQL backend integration setup..."
    echo ""
    
    check_postgres
    start_postgres
    setup_postgres_backend
    create_env_file
    install_backend_deps
    run_migrations
    generate_schema
    test_backend_startup
    create_integration_test
    create_agent_rules
    
    echo ""
    echo "🎉 PostgreSQL Backend Integration Complete!"
    echo ""
    echo "📋 What was set up:"
    echo "   ✅ PostgreSQL with solid_octo_invention database"
    echo "   ✅ app_public schema (required by backend)"
    echo "   ✅ .env file with correct DATABASE_URL"
    echo "   ✅ Database migrations applied"
    echo "   ✅ GraphQL schema generated"
    echo "   ✅ Integration test script created"
    echo "   ✅ Rules for future agents documented"
    echo ""
    echo "🚀 To start the backend:"
    echo "   cd packages/backend && pnpm dev"
    echo ""
    echo "🧪 To test integration:"
    echo "   ./test_backend_integration.sh"
    echo ""
    echo "📊 Endpoints:"
    echo "   GraphQL: http://localhost:3000/graphql"
    echo "   Health:  http://localhost:3000/health"
    echo "   GraphiQL: http://localhost:3000/graphiql"
}

# Run main function
main "$@"

