#!/usr/bin/env python3
"""
Simple PostgreSQL Backend Test
Quick test to verify PostgreSQL is running and can connect to backend stack
"""

import subprocess
import sys
import json
import tempfile
import os

def run_cmd(cmd, check=True):
    """Run command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=check)
        return result
    except subprocess.CalledProcessError as e:
        return e

def test_postgres_connection():
    """Test basic PostgreSQL connection"""
    print("🔍 Testing PostgreSQL connection...")
    
    result = run_cmd("pg_isready -h localhost -p 5432", check=False)
    if result.returncode != 0:
        print("❌ PostgreSQL is not running")
        print("   Run: sudo service postgresql start")
        return False
    
    result = run_cmd('psql -c "SELECT version();"', check=False)
    if result.returncode != 0:
        print("❌ Cannot connect to PostgreSQL")
        print(f"   Error: {result.stderr}")
        return False
    
    print("✅ PostgreSQL connection successful")
    return True

def test_database_operations():
    """Test database creation and basic operations"""
    print("\n🗄️ Testing database operations...")
    
    # Create test database
    run_cmd("dropdb codegen_test", check=False)  # Clean up if exists
    result = run_cmd("createdb codegen_test", check=False)
    if result.returncode != 0:
        print("❌ Failed to create test database")
        return False
    
    # Test table creation and data insertion
    sql = """
    CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100), email VARCHAR(255));
    INSERT INTO users (name, email) VALUES ('Test User', 'test@codegen.com');
    SELECT * FROM users;
    """
    
    result = run_cmd(f'psql codegen_test -c "{sql}"', check=False)
    if result.returncode != 0:
        print("❌ Failed to create table and insert data")
        print(f"   Error: {result.stderr}")
        return False
    
    if "Test User" not in result.stdout:
        print("❌ Data insertion failed")
        return False
    
    print("✅ Database operations successful")
    return True

def test_migration_simulation():
    """Test database migration simulation"""
    print("\n🔄 Testing migration simulation...")
    
    # Create migration file
    migration_sql = """
    -- Migration: Add posts table
    CREATE TABLE posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Add sample data
    INSERT INTO posts (title, content, user_id) 
    VALUES ('Hello World', 'This is a test post', 1);
    """
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
        f.write(migration_sql)
        migration_file = f.name
    
    try:
        result = run_cmd(f"psql codegen_test -f {migration_file}", check=False)
        if result.returncode != 0:
            print("❌ Migration failed")
            print(f"   Error: {result.stderr}")
            return False
        
        # Verify migration worked
        result = run_cmd('psql codegen_test -c "SELECT COUNT(*) FROM posts;"', check=False)
        if result.returncode != 0 or "1" not in result.stdout:
            print("❌ Migration verification failed")
            return False
        
        print("✅ Migration simulation successful")
        return True
        
    finally:
        os.unlink(migration_file)

def test_json_queries():
    """Test JSON queries for GraphQL-like operations"""
    print("\n📊 Testing JSON queries (GraphQL simulation)...")
    
    # Test JSON aggregation query (simulates GraphQL resolver)
    json_query = """
    SELECT json_build_object(
        'users', (
            SELECT json_agg(
                json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'email', u.email,
                    'posts', (
                        SELECT json_agg(
                            json_build_object(
                                'id', p.id,
                                'title', p.title,
                                'content', p.content
                            )
                        )
                        FROM posts p WHERE p.user_id = u.id
                    )
                )
            )
            FROM users u
        )
    ) as graphql_response;
    """
    
    result = run_cmd(f'psql codegen_test -t -c "{json_query}"', check=False)
    if result.returncode != 0:
        print("❌ JSON query failed")
        print(f"   Error: {result.stderr}")
        return False
    
    try:
        # Verify JSON response is valid
        json_response = json.loads(result.stdout.strip())
        if 'users' not in json_response or not json_response['users']:
            print("❌ JSON response structure invalid")
            return False
        
        print("✅ JSON queries successful (GraphQL-ready)")
        return True
        
    except json.JSONDecodeError:
        print("❌ Invalid JSON response")
        print(f"   Response: {result.stdout}")
        return False

def test_connection_pooling():
    """Test multiple concurrent connections"""
    print("\n⚡ Testing connection pooling...")
    
    # Test multiple simultaneous connections
    commands = []
    for i in range(5):
        commands.append(f'psql codegen_test -c "SELECT {i} as connection_test, pg_backend_pid() as pid;"')
    
    # Run commands in parallel using background processes
    processes = []
    for cmd in commands:
        proc = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        processes.append(proc)
    
    # Wait for all to complete
    results = []
    for proc in processes:
        stdout, stderr = proc.communicate()
        results.append((proc.returncode, stdout.decode(), stderr.decode()))
    
    # Check results
    success_count = sum(1 for returncode, _, _ in results if returncode == 0)
    
    if success_count != len(commands):
        print(f"❌ Connection pooling test failed ({success_count}/{len(commands)} succeeded)")
        return False
    
    print(f"✅ Connection pooling successful ({success_count} concurrent connections)")
    return True

def cleanup():
    """Clean up test resources"""
    print("\n🧹 Cleaning up...")
    run_cmd("dropdb codegen_test", check=False)
    print("Test database cleaned up")

def main():
    """Run all tests"""
    print("🧪 PostgreSQL Backend Integration Test")
    print("=" * 40)
    
    tests = [
        ("PostgreSQL Connection", test_postgres_connection),
        ("Database Operations", test_database_operations),
        ("Migration Simulation", test_migration_simulation),
        ("JSON Queries (GraphQL)", test_json_queries),
        ("Connection Pooling", test_connection_pooling)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                print(f"❌ {test_name} failed")
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
    
    cleanup()
    
    print(f"\n📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! PostgreSQL is ready for backend development.")
        print("\n🚀 Next steps:")
        print("   • Use 'psql codegen_test' to connect to your database")
        print("   • Run migrations with 'psql dbname -f migration.sql'")
        print("   • Build GraphQL resolvers using JSON queries")
        print("   • Set DATABASE_URL environment variable for your app")
        return True
    else:
        print("⚠️  Some tests failed. Check PostgreSQL setup.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

