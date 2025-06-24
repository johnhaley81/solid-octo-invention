#!/bin/bash

# Codegen Sandbox Setup Script
# Sets up PostgreSQL and pulls latest code with dependencies

set -e

echo "🚀 Setting up Codegen Sandbox"
echo "============================="

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
sudo apt update
sudo apt install -y postgresql postgresql-contrib postgresql-client

# Start PostgreSQL service
echo "🔧 Starting PostgreSQL service..."
sudo service postgresql start

# Configure PostgreSQL
echo "⚙️  Configuring PostgreSQL..."
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"

# Create the database
echo "🗄️  Creating database..."
sudo -u postgres createdb solid_octo_invention

# Pull latest from main
echo "📥 Pulling latest from main..."
git fetch origin main
git checkout main
git pull origin main

# Copy and configure .env file
echo "⚙️  Setting up environment configuration..."
cp .env.example .env
sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/solid_octo_invention|' .env

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Run migrations
echo "🗄️  Running migrations..."
cd packages/backend/packages/migrate
pnpm migrate:up

echo ""
echo "✅ Codegen sandbox setup complete!"
echo ""
echo "🚀 Ready to develop! Your environment includes:"
echo "   - PostgreSQL running on localhost:5432"
echo "   - Latest code from main branch"
echo "   - All dependencies installed"
echo "   - Database migrations applied"
