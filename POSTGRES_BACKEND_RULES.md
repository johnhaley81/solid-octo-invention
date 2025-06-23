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

# Commit current.sql to new migration
pnpm migrate:commit
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

**Error**: `password authentication failed for user "postgres"`
**Solution**: Configure PostgreSQL authentication:
```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo sed -i "s/local   all             all                                     peer/local   all             all                                     trust/" /etc/postgresql/15/main/pg_hba.conf
sudo service postgresql restart
```

**Error**: `listen EADDRINUSE: address already in use :::3000`
**Solution**: Kill existing processes: `pkill -f "pnpm dev"` or use different port: `PORT=3001 pnpm dev`

**Error**: `GET DIAGNOSTICS` syntax error in migrations
**Solution**: Fix SQL syntax in current.sql - use temporary variables for complex operations

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

## 🔧 Quick Setup Commands

### Full Setup (First Time)
```bash
# Run the complete setup script
./setup_postgres_backend_integration.sh

# Test the integration
./test_backend_integration.sh
```

### Daily Development Workflow
```bash
# 1. Start PostgreSQL
sudo service postgresql start

# 2. Start backend
cd packages/backend && pnpm dev

# 3. Access endpoints
# GraphQL: http://localhost:3000/graphql
# Health: http://localhost:3000/health
# GraphiQL: http://localhost:3000/graphiql
```

### Schema Management
```bash
# Generate GraphQL schema manually
cd packages/backend/packages/migrate && node dump-schema.js

# Apply new migrations
cd packages/backend/packages/migrate && pnpm migrate:up

# Create new migration from current.sql
cd packages/backend/packages/migrate && pnpm migrate:commit
```

## 📁 File Structure
```
packages/
  backend/
    packages/
      migrate/
        migrations/
          current.sql          # Current schema state
          000001.sql          # Committed migration
        dump-schema.js        # Schema dump utility
        .gmrc                # Migration configuration
    src/
      config/
        index.ts            # Environment configuration
      server.ts             # Main server with PostGraphile
    schema.graphql          # Generated GraphQL schema
    package.json
.env                        # Environment variables
.env.example               # Environment template
setup_postgres_backend_integration.sh  # Setup script
test_backend_integration.sh           # Integration test
POSTGRES_BACKEND_RULES.md            # This file
```

## 🚀 Architecture Overview

The backend uses a sophisticated stack:
- **PostGraphile**: Automatic GraphQL API from PostgreSQL schema
- **Effect-TS**: Functional programming and dependency injection
- **Graphile-migrate**: Database migration management
- **Express**: HTTP server framework
- **PostgreSQL**: Database with app_public schema

The integration ensures that:
1. PostgreSQL provides the data layer with proper schema separation
2. PostGraphile automatically generates GraphQL API from the database schema
3. Effect-TS manages configuration and services
4. Migrations keep the database schema in sync
5. Schema generation provides type safety for frontend development

This setup enables rapid development with type-safe database operations and automatic API generation.

