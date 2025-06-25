# Codegen Sandbox Setup

This directory contains scripts to set up and maintain your codegen sandbox
environment.

## Scripts Overview

### 🚀 `setup-codegen-sandbox.sh` - Main Setup Script

The primary setup script that handles git operations and dependency
installation.

**What it does:**

- Pulls the latest code from the main branch
- Installs all project dependencies with pnpm
- Calls the database setup script to configure PostgreSQL
- Provides a complete development environment setup

**Usage:**

```bash
./setup-codegen-sandbox.sh
```

### 🔧 `fix-database-issues.sh` - Database Troubleshooting Tool

A dedicated script for diagnosing and fixing PostgreSQL database issues.

**What it does:**

- Installs PostgreSQL if not present
- Starts and enables PostgreSQL service
- Creates required databases (main and test)
- Configures database user and permissions
- Sets up environment variables
- Runs database migrations
- Verifies database connectivity

**Usage:**

```bash
# Fix all database issues (default)
./fix-database-issues.sh
./fix-database-issues.sh fix

# Only diagnose issues without fixing
./fix-database-issues.sh diagnose

# Test database connection
./fix-database-issues.sh test

# Show help
./fix-database-issues.sh help
```

## Quick Start

1. **Initial Setup:**

   ```bash
   ./setup-codegen-sandbox.sh
   ```

2. **If you encounter database issues later:**

   ```bash
   ./fix-database-issues.sh
   ```

3. **To test your database connection:**
   ```bash
   ./fix-database-issues.sh test
   ```

## Troubleshooting

### Common Issues

**PostgreSQL service not running:**

```bash
./fix-database-issues.sh fix
```

**Database connection errors:**

```bash
./fix-database-issues.sh diagnose  # Check what's wrong
./fix-database-issues.sh fix       # Fix the issues
```

**Migration failures:**

```bash
./fix-database-issues.sh fix       # Will re-run migrations
```

### Manual Verification

After setup, you can manually verify your database connection:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d solid_octo_invention -c 'SELECT version();'
```

## Script Features

### Idempotent Operations

Both scripts are designed to be run multiple times safely:

- Won't reinstall PostgreSQL if already present
- Won't recreate databases if they exist
- Won't overwrite existing configuration files

### Comprehensive Error Handling

- Clear error messages with timestamps
- Retry logic for database connections
- Graceful failure with helpful suggestions

### Logging

- Timestamped log messages for debugging
- Clear status indicators (✅ ❌ ⚠️)
- Progress tracking for long operations

## Development Workflow

1. **Daily setup:** Run `./setup-codegen-sandbox.sh` to get latest code and
   ensure everything is working
2. **Database issues:** Use `./fix-database-issues.sh` to diagnose and fix any
   database problems
3. **Quick checks:** Use `./fix-database-issues.sh test` to verify database
   connectivity

## Environment Details

- **Database:** PostgreSQL 15+
- **Main Database:** `solid_octo_invention`
- **Test Database:** `solid_octo_invention_test`
- **Connection:**
  `postgresql://postgres:postgres@localhost:5432/solid_octo_invention`
- **Service:** Automatically enabled to start on boot

## E2E Testing in Sandbox

### 🎭 `run-e2e-tests.sh` - Comprehensive E2E Test Runner

A dedicated script for running end-to-end tests with full server orchestration.

**What it does:**

- Starts backend server (port 3001) and frontend server (port 5173)
- Waits for both servers to be ready with health checks
- Runs Playwright e2e tests with proper environment setup
- Automatically cleans up servers after tests complete
- Provides detailed logging and error handling

**Usage:**

```bash
# Run full e2e test suite
./run-e2e-tests.sh
pnpm test:e2e

# Run tests with Playwright UI
./run-e2e-tests.sh --ui
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
./run-e2e-tests.sh --headed
pnpm test:e2e:headed

# Run specific test file
./run-e2e-tests.sh tests/auth.spec.ts

# Start servers for manual testing
./run-e2e-tests.sh --start
pnpm test:e2e:start

# Cleanup any running servers
./run-e2e-tests.sh --cleanup
pnpm test:e2e:cleanup
```

**Features:**

- **Automatic Server Management:** Starts and stops both backend and frontend
  servers
- **Health Checking:** Waits for servers to be ready before running tests
- **Port Conflict Detection:** Handles existing servers gracefully
- **Comprehensive Cleanup:** Ensures no orphaned processes remain
- **Detailed Logging:** Timestamped logs with color coding for easy debugging
- **Flexible Arguments:** Pass any Playwright arguments through to the test
  runner

**Server Configuration:**

- **Backend:** http://localhost:3001 (GraphQL endpoint: /graphql, Health:
  /health)
- **Frontend:** http://localhost:5173
- **Database:** PostgreSQL on localhost:5432
- **Test Environment:** Automatically configured for e2e testing

### E2E Test Development

The e2e tests are located in `packages/frontend/tests/` and use Playwright for
browser automation.

**Available Test Files:**

- `basic.spec.ts` - Basic application functionality tests
- `auth.spec.ts` - Authentication flow tests

**Test Reports:** After running tests, reports are available at:

- HTML Report: `packages/frontend/playwright-report/index.html`
- View with: `pnpm --filter frontend exec playwright show-report`

### Troubleshooting E2E Tests

**Server startup issues:**

```bash
./run-e2e-tests.sh --cleanup  # Clean up any stuck processes
./fix-database-issues.sh      # Ensure database is working
./run-e2e-tests.sh --start    # Test server startup manually
```

**Test failures:**

```bash
./run-e2e-tests.sh --headed   # Run tests in headed mode to see what's happening
./run-e2e-tests.sh --ui       # Use Playwright UI for debugging
```

**Port conflicts:** The script automatically detects and handles port conflicts,
but you can manually check:

```bash
lsof -i :3001  # Check backend port
lsof -i :5173  # Check frontend port
```
