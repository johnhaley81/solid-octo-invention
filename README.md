# Solid Octo Invention

A modern full-stack application built with functional programming principles,
domain-driven design, and type safety from database to UI.

## 🏗️ Architecture

This application follows a clean architecture approach with:

- **Backend**: PostGraphile + Graphile Worker + Effect-TS
- **Frontend**: React + Apollo Client + Effect-TS
- **Database**: PostgreSQL with Row Level Security
- **Caching**: Redis for sessions and background jobs
- **Type Safety**: End-to-end TypeScript with Effect-TS schemas

## 🚀 Tech Stack

### Backend

- [PostGraphile](https://www.graphile.org/postgraphile/) - Automatic GraphQL API
  from PostgreSQL schema
- [Graphile Worker](https://github.com/graphile/worker) - Background job
  processing
- [Graphile Migrate](https://github.com/graphile/migrate) - Database schema
  management
- [Effect-TS](https://effect.website/) - Functional programming with type-safe
  effects
- [Express](https://expressjs.com/) - Web server framework

### Frontend

- [React 18](https://react.dev/) - UI library with concurrent features
- [Apollo Client](https://www.apollographql.com/docs/react/) - GraphQL client
  with intelligent caching
- [React Router](https://reactrouter.com/) - Client-side routing
- [Vite](https://vitejs.dev/) - Fast build tool and dev server

### Development

- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager
- [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) - Code
  quality and formatting
- [Vitest](https://vitest.dev/) - Unit testing
- [Playwright](https://playwright.dev/) - E2E testing

## 🎯 Core Principles

1. **Pure Functional Programming** - Immutable data structures and pure
   functions
2. **Domain-Driven Development** - Clear domain boundaries and ubiquitous
   language
3. **Making Impossible States Impossible** - Leveraging TypeScript's type system
4. **Type Safety** - From database schema to UI components
5. **Effect-TS Integration** - Composable, type-safe side effects

## 📁 Project Structure

```
├── packages/
│   ├── backend/          # PostGraphile API server
│   │   ├── src/
│   │   │   ├── server.ts       # Express server setup
│   │   │   ├── services/       # Effect-TS services
│   │   │   └── worker/         # Background job handlers
│   │   └── migrations/         # Database migrations
│   ├── frontend/         # React application
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── routes/         # Page components
│   │   │   ├── apollo/         # GraphQL client setup
│   │   │   └── graphql/        # GraphQL queries/mutations
│   └── shared/           # Shared types and schemas
│       └── src/
│           ├── schemas/        # Effect-TS schemas
│           ├── errors/         # Domain error types
│           └── types/          # Common TypeScript types
├── .github/workflows/    # CI/CD configuration
└── docker-compose.yml    # Local development services
```

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd solid-octo-invention
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start local services**

   ```bash
   pnpm db:up
   ```

4. **Run database migrations**

   ```bash
   pnpm migrate:up
   ```

5. **Start development servers**
   ```bash
   pnpm dev
   ```

This will start:

- Backend API server at http://localhost:3000
- Frontend development server at http://localhost:5173
- GraphiQL interface at http://localhost:3000/graphiql

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `VITE_GRAPHQL_ENDPOINT` - GraphQL endpoint for frontend

## 🧪 Testing

### Unit Tests

```bash
pnpm test:unit
```

### E2E Tests

```bash
pnpm test:e2e
```

### Run All Tests

```bash
pnpm test
```

## 🔍 Code Quality

### Pre-Push Hook

This project includes a comprehensive pre-push git hook that automatically runs
quality checks before allowing pushes:

- **Type Checking**: Ensures TypeScript types are valid across all packages
- **Linting**: Runs ESLint to catch code quality issues
- **Formatting**: Verifies code formatting with Prettier
- **Building**: Ensures all packages build successfully
- **Testing**: Runs unit tests to verify functionality
- **Secret Scanning**: Uses trufflehog to detect potential secrets

The hook runs automatically on `git push`. Configure it via `.pre-push-config`:

```bash
# Enable/disable specific checks
ENABLE_BUILD_CHECKS=true
ENABLE_LINT_CHECKS=true
ENABLE_TYPE_CHECKS=true
ENABLE_TEST_CHECKS=true
ENABLE_SECRET_SCANNING=true

# Skip checks for emergency branches
SKIP_BRANCHES="hotfix/*,release/*"

# Adjust timeout for large projects
CHECK_TIMEOUT=600
```

To bypass the hook in emergencies:

```bash
git push --no-verify
```

### Manual Quality Checks

You can also run quality checks manually:

#### Linting

```bash
pnpm lint
pnpm lint:fix
```

#### Type Checking

```bash
pnpm type-check
```

#### Formatting

```bash
pnpm format
pnpm format:check
```

## 🚀 Deployment

### Docker Production Build

1. **Build production images**

   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. **Start production services**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### CI/CD Pipeline

The project includes a comprehensive GitHub Actions workflow that:

- ✅ Runs type checking across all packages
- ✅ Performs linting and formatting checks
- ✅ Executes unit tests with PostgreSQL/Redis
- ✅ Builds all packages for production
- ✅ Runs E2E tests (on main branch)
- ✅ Performs security audits
- ✅ Blocks PR merging until all checks pass

## 📊 Database Schema

The application uses PostgreSQL with:

- **Row Level Security (RLS)** for data access control
- **Automatic timestamps** with triggers
- **UUID primary keys** for better distribution
- **Proper indexes** for query performance

Key entities:

- `users` - User accounts and profiles
- `posts` - Blog posts with status workflow
- `comments` - Threaded comments on posts

## 🔧 GraphQL API

PostGraphile automatically generates a GraphQL API from the PostgreSQL schema
with:

- **CRUD operations** for all tables
- **Computed fields** via PostgreSQL functions
- **Real-time subscriptions** via GraphQL subscriptions
- **Automatic pagination** with cursor-based pagination
- **Field-level permissions** via RLS policies

## 🎨 Frontend Architecture

The React frontend follows modern patterns:

- **Functional components** with hooks
- **Apollo Client** for GraphQL data fetching
- **Effect-TS** for business logic and error handling
- **Component composition** over inheritance
- **Type-safe routing** with React Router

## 🔄 Background Jobs

Graphile Worker handles background processing:

- **Email notifications**
- **Data processing tasks**
- **Scheduled maintenance**
- **External API integrations**

Jobs are defined as Effect-TS programs for composability and error handling.

## 📝 Effect-TS Integration

The application leverages Effect-TS for:

- **Service layer** - Database and external service interactions
- **Error handling** - Tagged errors with proper error boundaries
- **Business logic** - Pure, composable domain operations
- **Resource management** - Automatic cleanup and resource pooling

## 🔒 Security

Security measures include:

- **Row Level Security** in PostgreSQL
- **Input validation** with Effect-TS schemas
- **CORS configuration** for API access
- **Helmet.js** for security headers
- **Dependency auditing** in CI pipeline

## 📚 Learning Resources

- [Effect-TS Documentation](https://effect.website/)
- [PostGraphile Documentation](https://www.graphile.org/postgraphile/)
- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the coding standards
4. Ensure all tests pass
5. Submit a pull request

All PRs must pass CI checks before merging.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
