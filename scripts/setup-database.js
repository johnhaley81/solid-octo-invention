#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres', // Connect to default database first
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

const dbName = process.env.DB_NAME || 'auth_system';

async function setupDatabase() {
  let client;
  
  try {
    console.log('🔍 Connecting to PostgreSQL...');
    client = await pool.connect();
    
    // Check if database exists
    console.log(`🔍 Checking if database '${dbName}' exists...`);
    const dbCheckResult = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    
    if (dbCheckResult.rows.length === 0) {
      console.log(`📦 Creating database '${dbName}'...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log('✅ Database created successfully');
    } else {
      console.log('✅ Database already exists');
    }
    
    client.release();
    
    // Connect to the target database
    console.log(`🔍 Connecting to database '${dbName}'...`);
    const targetPool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: dbName,
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
    });
    
    const targetClient = await targetPool.connect();
    
    // Read and execute schema
    console.log('📋 Reading database schema...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('🏗️  Executing database schema...');
    await targetClient.query(schema);
    console.log('✅ Database schema applied successfully');
    
    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const tablesResult = await targetClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    console.log('📊 Created tables:', tables.join(', '));
    
    targetClient.release();
    await targetPool.end();
    
    console.log('');
    console.log('🎉 Database setup completed successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Copy .env.example to .env and configure your settings');
    console.log('2. Update database credentials in .env file');
    console.log('3. Configure email settings for OTP functionality');
    console.log('4. Run: npm start');
    console.log('');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Database Setup Script');
  console.log('');
  console.log('Usage: node scripts/setup-database.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --force        Drop existing database and recreate');
  console.log('');
  console.log('Environment Variables:');
  console.log('  DB_HOST        Database host (default: localhost)');
  console.log('  DB_PORT        Database port (default: 5432)');
  console.log('  DB_NAME        Database name (default: auth_system)');
  console.log('  DB_USER        Database user (default: postgres)');
  console.log('  DB_PASSWORD    Database password (default: password)');
  process.exit(0);
}

if (args.includes('--force')) {
  console.log('⚠️  Force mode enabled - existing database will be dropped!');
  console.log('This will delete all existing data.');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  
  setTimeout(async () => {
    try {
      const client = await pool.connect();
      console.log(`🗑️  Dropping database '${dbName}'...`);
      await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      console.log('✅ Database dropped');
      client.release();
      await setupDatabase();
    } catch (error) {
      console.error('❌ Force setup failed:', error);
      process.exit(1);
    }
  }, 5000);
} else {
  setupDatabase();
}

