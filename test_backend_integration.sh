#!/bin/bash

# Backend Integration Test Script
# Tests the complete PostgreSQL + Backend integration

set -e

echo "🧪 Testing Backend Integration"
echo "============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Test database connectivity
print_info "Testing database connection..."
if psql postgresql://postgres:postgres@localhost:5432/solid_octo_invention -c "SELECT current_database(), current_schema();" > /dev/null 2>&1; then
    print_success "Database connection successful"
else
    print_error "Database connection failed"
    exit 1
fi

# Test app_public schema
print_info "Testing app_public schema..."
if psql postgresql://postgres:postgres@localhost:5432/solid_octo_invention -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'app_public';" | grep -q "app_public"; then
    print_success "app_public schema exists"
else
    print_error "app_public schema not found"
    exit 1
fi

# Test .env file
print_info "Testing .env configuration..."
if [ -f ".env" ] && grep -q "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/solid_octo_invention" .env; then
    print_success ".env file configured correctly"
else
    print_error ".env file missing or misconfigured"
    exit 1
fi

# Test schema.graphql generation
print_info "Testing GraphQL schema generation..."
if [ -f "packages/backend/schema.graphql" ]; then
    schema_size=$(wc -l < packages/backend/schema.graphql)
    print_success "GraphQL schema exists ($schema_size lines)"
else
    print_error "GraphQL schema not found"
    exit 1
fi

# Test backend startup (background)
print_info "Testing backend startup..."
cd packages/backend

# Kill any existing processes
pkill -f "pnpm dev" 2>/dev/null || true
sleep 1

# Start backend on port 3001 to avoid conflicts
PORT=3001 timeout 15s pnpm dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 8

# Test health endpoint
if curl -s http://localhost:3001/health | grep -q "ok"; then
    print_success "Backend health check passed"
else
    print_error "Backend health check failed"
    kill $BACKEND_PID 2>/dev/null || true
    cd - > /dev/null
    exit 1
fi

# Test GraphQL endpoint
if curl -s http://localhost:3001/graphql -H "Content-Type: application/json" -d '{"query":"{ __schema { types { name } } }"}' | grep -q "types"; then
    print_success "GraphQL endpoint responding"
else
    print_error "GraphQL endpoint not responding"
    kill $BACKEND_PID 2>/dev/null || true
    cd - > /dev/null
    exit 1
fi

# Test migration system
print_info "Testing migration system..."
cd packages/migrate
if pnpm migrate:up > /dev/null 2>&1; then
    print_success "Migration system working"
else
    print_error "Migration system failed"
    kill $BACKEND_PID 2>/dev/null || true
    cd - > /dev/null
    exit 1
fi

# Test schema dump
print_info "Testing schema dump..."
if node dump-schema.js > /dev/null 2>&1; then
    print_success "Schema dump working"
else
    print_error "Schema dump failed"
    kill $BACKEND_PID 2>/dev/null || true
    cd - > /dev/null
    exit 1
fi

# Clean up
kill $BACKEND_PID 2>/dev/null || true
cd - > /dev/null

echo ""
print_success "All integration tests passed!"
echo ""
echo "🚀 Your backend is ready! Run:"
echo "   cd packages/backend && pnpm dev"
echo ""
echo "📊 Endpoints:"
echo "   GraphQL: http://localhost:3000/graphql"
echo "   Health:  http://localhost:3000/health"
echo "   GraphiQL: http://localhost:3000/graphiql"
echo ""
echo "🛠️  Management commands:"
echo "   Migrations: cd packages/backend/packages/migrate && pnpm migrate:up"
echo "   Schema dump: cd packages/backend/packages/migrate && node dump-schema.js"

