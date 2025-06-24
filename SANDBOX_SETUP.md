# Codegen Sandbox Setup

This directory contains scripts to set up and maintain your codegen sandbox environment.

## Scripts Overview

### 🚀 `setup-codegen-sandbox.sh` - Main Setup Script
The primary setup script that handles git operations and dependency installation.

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

1. **Daily setup:** Run `./setup-codegen-sandbox.sh` to get latest code and ensure everything is working
2. **Database issues:** Use `./fix-database-issues.sh` to diagnose and fix any database problems
3. **Quick checks:** Use `./fix-database-issues.sh test` to verify database connectivity

## Environment Details

- **Database:** PostgreSQL 15+
- **Main Database:** `solid_octo_invention`
- **Test Database:** `solid_octo_invention_test`
- **Connection:** `postgresql://postgres:postgres@localhost:5432/solid_octo_invention`
- **Service:** Automatically enabled to start on boot

