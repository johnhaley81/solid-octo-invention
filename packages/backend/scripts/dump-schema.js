#!/usr/bin/env node

/**
 * Schema dump script for Graphile Migrate
 *
 * This script connects to the database after migrations and creates a schema dump
 * that represents the current state of the database. This dump is used by CI
 * to validate that migrations produce the expected schema.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get database URL from environment or .gmrc
const getDatabaseUrl = () => {
  // Try environment variable first
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Try to read from .gmrc file
  try {
    const gmrcPath = path.join(__dirname, '..', '.gmrc');
    if (fs.existsSync(gmrcPath)) {
      const gmrcContent = fs.readFileSync(gmrcPath, 'utf8');
      const gmrc = JSON.parse(gmrcContent);
      return gmrc.connectionString;
    }
  } catch (error) {
    console.warn('Could not read .gmrc file:', error.message);
  }

  // Fallback to default
  return 'postgresql://postgres:postgres@localhost:5432/solid_octo_invention';
};

const main = () => {
  try {
    const databaseUrl = getDatabaseUrl();
    console.log('Creating schema dump...');

    // Use pg_dump to create a schema-only dump
    const dumpCommand = `pg_dump "${databaseUrl}" --schema-only --no-owner --no-privileges --no-comments`;

    const schemaDump = execSync(dumpCommand, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    // Clean up the dump (remove variable parts like timestamps, versions)
    const cleanedDump = schemaDump
      .split('\n')
      .filter(line => {
        // Remove comment lines that contain versions or timestamps
        if (
          line.startsWith('--') &&
          (line.includes('Dumped from database version') ||
            line.includes('Dumped by pg_dump version') ||
            line.includes('Started on') ||
            line.includes('Completed on'))
        ) {
          return false;
        }
        return true;
      })
      .join('\n')
      .trim();

    // Write to schema dump file
    const schemaPath = path.join(__dirname, '..', 'schema-dump.sql');
    fs.writeFileSync(schemaPath, cleanedDump + '\n');

    console.log(`Schema dump created: ${schemaPath}`);
    console.log(`Schema dump size: ${cleanedDump.length} characters`);
  } catch (error) {
    console.error('Failed to create schema dump:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };
