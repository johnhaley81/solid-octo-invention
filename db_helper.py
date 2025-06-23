#!/usr/bin/env python3
"""
Database Helper for Codegen Sandbox
Provides easy database operations for development
"""

import os
import subprocess
import sys
import time

def run_command(cmd, check=True):
    """Run a shell command"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=check)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {cmd}")
        print(f"Error: {e.stderr}")
        if check:
            sys.exit(1)
        return None

def check_postgres_running():
    """Check if PostgreSQL is running"""
    result = run_command("pg_isready -h localhost -p 5432", check=False)
    return result is not None

def start_postgres():
    """Start PostgreSQL service"""
    print("🚀 Starting PostgreSQL...")
    run_command("sudo service postgresql start")
    
    # Wait for it to be ready
    for i in range(10):
        if check_postgres_running():
            print("✅ PostgreSQL is ready!")
            return True
        time.sleep(1)
    
    print("❌ PostgreSQL failed to start")
    return False

def create_database(db_name):
    """Create a new database"""
    print(f"📊 Creating database: {db_name}")
    run_command(f"createdb {db_name}", check=False)

def connect_to_db(db_name=""):
    """Connect to PostgreSQL with psql"""
    if db_name:
        run_command(f"psql {db_name}")
    else:
        run_command("psql")

def show_status():
    """Show PostgreSQL status"""
    print("📊 PostgreSQL Status:")
    print("=" * 30)
    
    if check_postgres_running():
        print("✅ PostgreSQL is running")
        
        # Show databases
        print("\n📚 Available databases:")
        result = run_command("psql -l -t", check=False)
        if result:
            for line in result.split('\n'):
                if '|' in line and not line.strip().startswith('-'):
                    db_name = line.split('|')[0].strip()
                    if db_name and db_name not in ['template0', 'template1']:
                        print(f"  • {db_name}")
    else:
        print("❌ PostgreSQL is not running")
        print("Run: python3 db_helper.py start")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        show_status()
        print("\nUsage:")
        print("  python3 db_helper.py start          - Start PostgreSQL")
        print("  python3 db_helper.py status         - Show status")
        print("  python3 db_helper.py create <name>  - Create database")
        print("  python3 db_helper.py connect [name] - Connect to database")
        sys.exit(0)
    
    command = sys.argv[1]
    
    if command == "start":
        start_postgres()
    elif command == "status":
        show_status()
    elif command == "create" and len(sys.argv) > 2:
        create_database(sys.argv[2])
    elif command == "connect":
        db_name = sys.argv[2] if len(sys.argv) > 2 else ""
        connect_to_db(db_name)
    else:
        print("Unknown command. Use: start, status, create, or connect")
