#!/usr/bin/env python3
"""
Example usage of PostgreSQL in Codegen Sandbox
This demonstrates how to use PostgreSQL for development tasks
"""

import subprocess
import sys

def run_sql(sql, database="testdb"):
    """Execute SQL command and return result"""
    try:
        result = subprocess.run(
            ["psql", database, "-c", sql],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"SQL Error: {e.stderr}")
        return None

def main():
    print("🐘 PostgreSQL Example for Codegen Sandbox")
    print("=" * 50)
    
    # Check if PostgreSQL is running
    try:
        subprocess.run(["pg_isready"], check=True, capture_output=True)
        print("✅ PostgreSQL is running")
    except subprocess.CalledProcessError:
        print("❌ PostgreSQL is not running. Start it with:")
        print("   sudo service postgresql start")
        sys.exit(1)
    
    # Create example database if it doesn't exist
    print("\n📊 Setting up example database...")
    subprocess.run(["createdb", "example_dev"], capture_output=True)
    
    # Create a sample table
    print("🏗️  Creating sample table...")
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(50) DEFAULT 'active'
    );
    """
    
    run_sql(create_table_sql, "example_dev")
    
    # Insert sample data
    print("📝 Inserting sample data...")
    insert_sql = """
    INSERT INTO projects (name, description) VALUES 
    ('Codegen Bot', 'AI-powered development assistant'),
    ('PostgreSQL Setup', 'Database configuration for sandbox'),
    ('API Gateway', 'Microservices communication layer')
    ON CONFLICT DO NOTHING;
    """
    
    run_sql(insert_sql, "example_dev")
    
    # Query data
    print("🔍 Querying data...")
    select_sql = "SELECT id, name, status, created_at FROM projects ORDER BY id;"
    result = run_sql(select_sql, "example_dev")
    
    if result:
        print("\n📋 Projects in database:")
        print(result)
    
    # Show database info
    print("\n📊 Database information:")
    info_sql = "SELECT current_database(), current_user, version();"
    result = run_sql(info_sql, "example_dev")
    
    if result:
        print(result)
    
    print("\n🎉 Example completed successfully!")
    print("\nNext steps:")
    print("• Connect to database: psql example_dev")
    print("• View tables: \\dt")
    print("• View data: SELECT * FROM projects;")
    print("• Use db_helper.py for easy management")

if __name__ == "__main__":
    main()

