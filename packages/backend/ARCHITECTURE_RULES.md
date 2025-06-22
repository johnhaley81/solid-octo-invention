# Backend Architecture Rules

This document outlines the architectural patterns and rules that must be followed in this project to maintain consistency and prevent anti-patterns.

## 🚫 PROHIBITED PATTERNS

### 1. REST API Endpoints
- **❌ NO REST endpoints** - All API interactions must go through GraphQL
- **❌ NO Express routes** for business logic (except health checks)
- **❌ NO custom middleware** for authentication - use PostGraphile's built-in features
- **❌ NO `/api/*` routes** - everything should be accessible via `/graphql`

### 2. Database Schema Violations
- **❌ NO boolean columns** - use `TIMESTAMPTZ` columns instead (e.g., `email_verified_at` not `email_verified`)
- **❌ NO TEXT columns with CHECK constraints** - use PostgreSQL ENUMs for better GraphQL type generation
- **❌ NO separate migration files** - all schema changes go in `current.sql`
- **❌ NO sensitive data in public schema** - use `app_private` schema for authentication tables

### 3. Background Processing Anti-patterns
- **❌ NO database functions for background tasks** - use graphile-worker jobs
- **❌ NO cron-like database functions** - schedule jobs through graphile-worker
- **❌ NO direct database cleanup functions** - implement as worker tasks

## ✅ REQUIRED PATTERNS

### 1. GraphQL-First Architecture
- **✅ USE PostGraphile functions** for custom mutations and queries
- **✅ USE PostgreSQL functions** with `SECURITY DEFINER` for business logic
- **✅ USE GraphQL mutations** for all user actions
- **✅ EXPOSE functions** via PostGraphile's automatic schema generation

### 2. Database Schema Best Practices
- **✅ USE `app_private` schema** for sensitive authentication data
- **✅ USE PostgreSQL ENUMs** instead of TEXT with CHECK constraints
- **✅ USE TIMESTAMPTZ columns** instead of boolean flags
- **✅ USE `current.sql`** as the single source of truth for schema
- **✅ USE Row Level Security (RLS)** for data access control

### 3. Background Processing
- **✅ USE graphile-worker** for all background tasks
- **✅ USE worker jobs** for email sending, cleanup, notifications
- **✅ USE scheduled jobs** for periodic maintenance tasks
- **✅ IMPLEMENT task handlers** in the worker service

### 4. Authentication Patterns
- **✅ USE PostgreSQL functions** for authentication logic
- **✅ USE `app_private` schema** for credentials and sessions
- **✅ USE PostGraphile's pgSettings** for user context
- **✅ USE RLS policies** with `current_setting('app.current_user_id')`

## 📁 File Organization

### Required Structure
```
packages/backend/
├── migrations/
│   └── current.sql              # Single source of truth for schema
├── src/
│   ├── services/
│   │   ├── database.ts          # Database connection service
│   │   └── worker.ts            # Graphile-worker service
│   └── server.ts                # PostGraphile server setup
└── ARCHITECTURE_RULES.md        # This file
```

### Prohibited Structure
```
❌ packages/backend/src/routes/     # No REST routes
❌ packages/backend/src/middleware/ # No custom auth middleware  
❌ packages/backend/src/services/auth/ # No auth service classes
❌ packages/backend/migrations/001-*.sql # No separate migrations
```

## 🔧 Implementation Guidelines

### Adding New Features
1. **Database First**: Define schema in `current.sql` with proper types and RLS
2. **Functions Second**: Create PostgreSQL functions for business logic
3. **GraphQL Third**: Functions automatically become GraphQL mutations/queries
4. **Workers Last**: Add background job handlers for async tasks

### Authentication Flow
1. **Registration**: PostgreSQL function → Worker job for email verification
2. **Login**: PostgreSQL function → Session creation → RLS context setting
3. **Authorization**: RLS policies using `current_setting('app.current_user_id')`
4. **Background Tasks**: Worker jobs for emails, cleanup, notifications

### Data Types
- ✅ `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- ✅ `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- ✅ `email_verified_at TIMESTAMPTZ` (not `email_verified BOOLEAN`)
- ✅ `auth_method auth_method_enum` (not `auth_method TEXT CHECK(...)`)

## 🚨 Enforcement

These rules are enforced through:
1. **Code Review**: All PRs must follow these patterns
2. **Documentation**: This file serves as the canonical reference
3. **Examples**: Existing code demonstrates correct patterns
4. **Testing**: Integration tests validate GraphQL-only access

## 📚 References

- [PostGraphile Documentation](https://www.graphile.org/postgraphile/)
- [Graphile Worker Documentation](https://github.com/graphile/worker)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

---

**Remember**: When in doubt, follow the GraphQL-first, PostgreSQL-native approach. Avoid REST patterns and custom middleware at all costs.

