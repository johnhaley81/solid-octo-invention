# PostgreSQL Backend Integration Tests

This document describes the comprehensive tests for PostgreSQL backend integration in the codegen sandbox, including database connectivity, migrations, and GraphQL server setup.

## 🧪 Test Suite Overview

The test suite includes multiple test scripts that verify different aspects of PostgreSQL backend integration:

### 1. Simple Backend Test (`test_postgres_simple.py`)
**Quick verification of core PostgreSQL functionality**

```bash
python3 test_postgres_simple.py
```

**Tests:**
- ✅ PostgreSQL connection and service status
- ✅ Database creation and basic operations
- ✅ Migration simulation with table creation
- ✅ JSON queries for GraphQL-like operations
- ✅ Connection pooling with concurrent connections

### 2. Comprehensive Backend Test (`test_postgres_backend.py`)
**Full integration test including GraphQL server**

```bash
python3 test_postgres_backend.py
```

**Tests:**
- ✅ PostgreSQL service verification
- ✅ Database creation and management
- ✅ Complex migration scenarios
- ✅ GraphQL server startup and query execution
- ✅ Performance testing with bulk operations

### 3. GraphQL Server Example (`graphql_server_example.js`)
**Working GraphQL server with PostgreSQL backend**

```bash
node graphql_server_example.js
```

**Features:**
- 🚀 Full GraphQL server with web playground
- 📊 PostgreSQL database integration
- 🔄 Automatic schema migration
- 🎮 Interactive query interface at `http://localhost:3000`

## 🚀 Quick Start

### Prerequisites
Ensure PostgreSQL is running:
```bash
sudo service postgresql start
# OR
./setup_postgres.sh
```

### Run All Tests
```bash
# Quick test
python3 test_postgres_simple.py

# Comprehensive test
python3 test_postgres_backend.py

# Start GraphQL server
node graphql_server_example.js
```

## 📊 Test Details

### Database Operations Test
Verifies basic database functionality:
- Creates test database `codegen_test`
- Creates `users` table with sample data
- Tests CRUD operations
- Verifies data integrity

### Migration Test
Simulates real-world database migrations:
- Creates migration SQL file
- Executes migration against test database
- Adds `posts` table with foreign key relationships
- Verifies migration success

### GraphQL Integration Test
Tests GraphQL-ready database operations:
- Complex JSON aggregation queries
- Nested data relationships (users with posts)
- GraphQL-style response formatting
- Performance with multiple resolvers

### Connection Pooling Test
Verifies database can handle concurrent connections:
- Spawns 5 simultaneous database connections
- Tests parallel query execution
- Verifies connection cleanup

## 🛠️ GraphQL Server Features

The included GraphQL server (`graphql_server_example.js`) demonstrates:

### Schema
```graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
  created_at: String!
}

type Post {
  id: ID!
  title: String!
  content: String
  author: User!
  created_at: String!
}

type Query {
  users: [User!]!
  posts: [Post!]!
  user(id: ID!): User
}

type Mutation {
  createUser(name: String!, email: String!): User!
  createPost(title: String!, content: String, user_id: ID!): Post!
}
```

### Example Queries

**Get all users with their posts:**
```graphql
{
  users {
    id
    name
    email
    posts {
      id
      title
      content
    }
  }
}
```

**Get all posts with authors:**
```graphql
{
  posts {
    id
    title
    content
    author {
      name
      email
    }
  }
}
```

**Create a new user:**
```graphql
{
  createUser(name: "John Doe", email: "john@example.com") {
    id
    name
    email
  }
}
```

## 🔧 Configuration

### Database Connection
The tests use these connection parameters:
- **Host:** `localhost`
- **Port:** `5432`
- **Authentication:** Trust-based (no password)
- **Test Database:** `codegen_test` or `codegen_graphql_test`

### Environment Variables
Optional configuration:
```bash
export DATABASE_URL="postgresql://localhost/your_database"
export PORT=3000  # For GraphQL server
```

## 📈 Performance Benchmarks

The test suite includes performance verification:
- **Bulk Insert:** 100 records in < 1 second
- **Query Performance:** Complex joins in < 100ms
- **Concurrent Connections:** 5+ simultaneous connections
- **JSON Aggregation:** Nested queries in < 200ms

## 🐛 Troubleshooting

### Common Issues

**PostgreSQL not running:**
```bash
sudo service postgresql start
```

**Permission denied:**
```bash
sudo -u postgres createuser --superuser $USER
```

**Database doesn't exist:**
```bash
createdb your_database_name
```

**Node.js dependencies missing:**
```bash
npm install pg
```

### Test Failures

If tests fail, check:
1. PostgreSQL service status: `sudo service postgresql status`
2. Connection permissions: `psql -c "SELECT version();"`
3. Database creation rights: `createdb test_connection`
4. Port availability: `netstat -tlnp | grep 5432`

## 🎯 Integration Examples

### Python with psycopg2
```python
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="your_db",
    user="your_user"
)

cursor = conn.cursor()
cursor.execute("SELECT * FROM users")
users = cursor.fetchall()
```

### Node.js with pg
```javascript
const { Client } = require('pg');

const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'your_db',
    user: 'your_user'
});

await client.connect();
const result = await client.query('SELECT * FROM users');
```

### Environment Variables
```bash
# For applications
export DATABASE_URL="postgresql://localhost/production_db"

# For testing
export TEST_DATABASE_URL="postgresql://localhost/test_db"
```

## 🚀 Next Steps

After running the tests successfully:

1. **Set up your application database:**
   ```bash
   createdb my_app_dev
   createdb my_app_test
   ```

2. **Create your schema migrations:**
   ```sql
   -- migrations/001_initial.sql
   CREATE TABLE your_table (...);
   ```

3. **Configure your application:**
   ```bash
   export DATABASE_URL="postgresql://localhost/my_app_dev"
   ```

4. **Build your GraphQL resolvers:**
   - Use the JSON query patterns from the tests
   - Implement proper error handling
   - Add authentication and authorization

5. **Deploy with confidence:**
   - All database operations are tested
   - Connection pooling is verified
   - Performance benchmarks are established

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [GraphQL Specification](https://graphql.org/learn/)
- [Node.js pg Driver](https://node-postgres.com/)
- [Python psycopg2 Driver](https://www.psycopg.org/)

---

These tests ensure that PostgreSQL is properly configured and ready for production-like backend development in the codegen sandbox environment.

