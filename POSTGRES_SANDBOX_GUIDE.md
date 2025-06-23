# PostgreSQL in Codegen Sandbox

This guide provides multiple approaches to run PostgreSQL in the codegen sandbox
environment for easier development.

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
chmod +x setup_postgres.sh
./setup_postgres.sh
```

### Option 2: Manual Native Installation

```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql-15 postgresql-client-15

# Start the service
sudo service postgresql start

# Create user and database
sudo -u postgres createuser --superuser $USER
sudo -u postgres createdb $USER

# Test connection
psql -c "SELECT version();"
```

### Option 3: Docker (if available)

```bash
# Note: Docker daemon may not be running in sandbox
docker run --name postgres-dev \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=codegen \
  -p 5432:5432 \
  -d postgres:15-alpine
```

## 📊 Connection Details

After setup, you can connect using:

- **Host**: `localhost`
- **Port**: `5432`
- **Database**: Your username or `codegen`
- **Username**: Your username or `postgres`
- **Password**: None required for local connections (or `postgres` for Docker)

## 🛠️ Usage Examples

### Basic Connection

```bash
# Connect to default database
psql

# Connect to specific database
psql -d myproject

# Connect with specific user
psql -U postgres -d codegen
```

### Python Usage

```python
import psycopg2

# Connect to PostgreSQL
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="codegen",
    user="postgres",
    password="postgres"  # Only needed for Docker setup
)

cursor = conn.cursor()
cursor.execute("SELECT version();")
print(cursor.fetchone())
conn.close()
```

### Node.js Usage

```javascript
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'codegen',
  user: 'postgres',
  password: 'postgres', // Only needed for Docker setup
});

client.connect();
client.query('SELECT version()', (err, res) => {
  console.log(res.rows[0]);
  client.end();
});
```

## 🔧 Database Helper Script

The setup creates a `db_helper.py` script for easy database management:

```bash
# Show status
python3 db_helper.py

# Start PostgreSQL
python3 db_helper.py start

# Create a new database
python3 db_helper.py create myproject

# Connect to database
python3 db_helper.py connect myproject
```

## 🐛 Troubleshooting

### PostgreSQL won't start

```bash
# Check if it's already running
sudo service postgresql status

# Start manually
sudo service postgresql start

# Check logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Connection refused

```bash
# Check if PostgreSQL is listening
sudo netstat -tlnp | grep 5432

# Test connection
pg_isready -h localhost -p 5432
```

### Permission denied

```bash
# Create user if doesn't exist
sudo -u postgres createuser --superuser $USER

# Reset password
sudo -u postgres psql -c "ALTER USER $USER PASSWORD 'newpassword';"
```

## 📚 Common Development Patterns

### 1. Project-specific Database

```bash
# Create database for your project
createdb myproject_dev

# Use in your application
export DATABASE_URL="postgresql://localhost/myproject_dev"
```

### 2. Test Database Setup

```bash
# Create test database
createdb myproject_test

# Run tests with test database
export TEST_DATABASE_URL="postgresql://localhost/myproject_test"
```

### 3. Database Migrations

```bash
# Example with a simple schema
psql myproject_dev << EOF
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
EOF
```

## 🔄 Starting Fresh

If you need to reset everything:

```bash
# Stop PostgreSQL
sudo service postgresql stop

# Remove data (careful!)
sudo rm -rf /var/lib/postgresql/15/main

# Reinstall
sudo apt remove --purge postgresql-15
sudo apt install postgresql-15

# Or just drop and recreate databases
dropdb myproject_dev
createdb myproject_dev
```

## 🌟 Pro Tips

1. **Environment Variables**: Set `DATABASE_URL` for easy connection string
   management
2. **Connection Pooling**: Use connection pooling libraries in production-like
   testing
3. **Backup/Restore**: Use `pg_dump` and `pg_restore` for data management
4. **Extensions**: Install useful extensions like `uuid-ossp`, `hstore`, etc.

```bash
# Install extensions
psql -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql -c "CREATE EXTENSION IF NOT EXISTS \"hstore\";"
```

## 🚨 Sandbox Limitations

- Docker daemon may not be available
- Services don't persist between sandbox sessions
- Limited system resources
- No external network access for some operations

## 📖 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [psql Command Reference](https://www.postgresql.org/docs/current/app-psql.html)
- [PostgreSQL Python Driver (psycopg2)](https://www.psycopg.org/)
- [PostgreSQL Node.js Driver (pg)](https://node-postgres.com/)

---

This setup provides a robust PostgreSQL environment for development work in the
codegen sandbox. Choose the approach that best fits your needs!
