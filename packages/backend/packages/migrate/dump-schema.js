#!/usr/bin/env node

/**
 * Schema dump script for Graphile Migrate
 *
 * This script connects to the database after migrations and creates a schema dump
 * that represents the current state of the database. This dump is used by CI
 * to validate that migrations produce the expected schema.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database URL from environment or .gmrc
const getDatabaseUrl = () => {
  // Try environment variable first, but ignore Graphile Migrate's placeholder
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('GM_DBURL')) {
    return process.env.DATABASE_URL;
  }

  // Try to read from .gmrc file
  try {
    const gmrcPath = path.join(__dirname, '.gmrc');
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

    // Check if we're running in a Docker environment with the specific container
    let dumpCommand;

    try {
      // Check if Docker is available and the specific container exists
      execSync('docker ps --format "table {{.Names}}" | grep -q solid-octo-postgres', {
        stdio: 'ignore',
      });

      // Use Docker container's pg_dump with the database URL modified for container network
      const containerDbUrl = databaseUrl.replace('localhost', 'postgres');
      dumpCommand = `docker exec solid-octo-postgres pg_dump "${containerDbUrl}" --schema-only --no-owner --no-privileges --no-comments --schema=app_public --schema=app_private`;

      console.log('Using Docker container pg_dump');
    } catch {
      // Fallback to local pg_dump if Docker is not available or container doesn't exist
      dumpCommand = `pg_dump "${databaseUrl}" --schema-only --no-owner --no-privileges --no-comments --schema=app_public --schema=app_private`;

      console.log('Using local pg_dump');
    }

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
    const schemaPath = path.join(__dirname, 'schema-dump.sql');

    fs.writeFileSync(schemaPath, `${cleanedDump}\n`);
  } catch (error) {
    console.error('Error in dump-schema.js:', error.message);
    process.exit(1);
  }
};

// Check if this file is being run directly (ES module equivalent of require.main === module)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
