#!/bin/bash

# PostgreSQL Setup Script for Codegen Sandbox
# This script provides multiple ways to run PostgreSQL in the sandbox environment

set -e

echo "🐘 PostgreSQL Setup for Codegen Sandbox"
echo "========================================"

# Function to install and setup native PostgreSQL
setup_native_postgres() {
    echo "📦 Installing PostgreSQL 15..."
    
    # Update package list
    sudo apt update -qq
    
    # Install PostgreSQL
    sudo apt install -y postgresql-15 postgresql-client-15 postgresql-contrib-15
    
    echo "🔧 Configuring PostgreSQL..."
    
    # Start PostgreSQL service
    sudo service postgresql start
    
    # Create a database user for the current user
    sudo -u postgres createuser --superuser $USER 2>/dev/null || echo "User $USER already exists"
    
    # Create a database for the current user
    sudo -u postgres createdb $USER 2>/dev/null || echo "Database $USER already exists"
    
    # Set password for postgres user (optional)
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true
    
    # Allow local connections
    sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/15/main/postgresql.conf
    
    # Configure authentication
    sudo sed -i "s/local   all             all                                     peer/local   all             all                                     trust/" /etc/postgresql/15/main/pg_hba.conf
    sudo sed -i "s/local   all             postgres                                peer/local   all             postgres                                trust/" /etc/postgresql/15/main/pg_hba.conf
    
    # Restart to apply configuration changes
    sudo service postgresql restart
    
    echo "✅ PostgreSQL is now running!"
    echo "📊 Connection details:"
    echo "   Host: localhost"
    echo "   Port: 5432"
    echo "   Database: $USER"
    echo "   Username: $USER (superuser) or postgres"
    echo "   Password: (none required for local connections)"
    
    # Test connection
    echo "🧪 Testing connection..."
    psql -c "SELECT version();" || echo "❌ Connection test failed"
}

# Function to setup PostgreSQL in Docker (if available)
setup_docker_postgres() {
    echo "🐳 Setting up PostgreSQL with Docker..."
    
    # Try to start Docker daemon
    if ! docker ps >/dev/null 2>&1; then
        echo "⚠️  Docker daemon not running. Attempting to start..."
        sudo service docker start || {
            echo "❌ Cannot start Docker daemon. Using native installation instead."
            setup_native_postgres
            return
        }
    fi
    
    # Pull and run PostgreSQL container
    docker run --name codegen-postgres \
        -e POSTGRES_PASSWORD=postgres \
        -e POSTGRES_DB=codegen \
        -p 5432:5432 \
        -d postgres:15-alpine
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
    
    # Install PostgreSQL client for connecting
    sudo apt update -qq && sudo apt install -y postgresql-client-15
    
    echo "✅ PostgreSQL Docker container is running!"
    echo "📊 Connection details:"
    echo "   Host: localhost"
    echo "   Port: 5432"
    echo "   Database: codegen"
    echo "   Username: postgres"
    echo "   Password: postgres"
    
    # Test connection
    echo "🧪 Testing connection..."
    PGPASSWORD=postgres psql -h localhost -U postgres -d codegen -c "SELECT version();" || echo "❌ Connection test failed"
}

# Function to create a simple database helper script
create_db_helper() {
    cat > db_helper.py << 'EOF'
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
EOF

    chmod +x db_helper.py
    echo "📝 Created db_helper.py for easy database management"
}

# Main execution
echo "Choose installation method:"
echo "1. Native PostgreSQL installation (recommended)"
echo "2. Docker PostgreSQL (if Docker is available)"
echo "3. Create helper scripts only"

read -p "Enter choice (1-3) [default: 1]: " choice
choice=${choice:-1}

case $choice in
    1)
        setup_native_postgres
        create_db_helper
        ;;
    2)
        setup_docker_postgres
        create_db_helper
        ;;
    3)
        create_db_helper
        echo "✅ Helper scripts created. Run setup manually if needed."
        ;;
    *)
        echo "Invalid choice. Using native installation."
        setup_native_postgres
        create_db_helper
        ;;
esac

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Quick start commands:"
echo "  psql                     - Connect to PostgreSQL"
echo "  python3 db_helper.py     - Show database status"
echo "  python3 db_helper.py start - Start PostgreSQL service"
echo ""
echo "For development, you can now use PostgreSQL in your projects!"

