#!/usr/bin/env node

/**
 * Wait for database to be ready before proceeding with migrations
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getDatabaseUrl = () => {
  // Try environment variable first
  if (process.env.DATABASE_URL) {
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

const waitForDatabase = async (maxAttempts = 30, delayMs = 1000) => {
  const databaseUrl = getDatabaseUrl();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try to connect using Docker container's pg_isready if available
      try {
        execSync('docker exec solid-octo-postgres pg_isready -U postgres', {
          stdio: 'ignore',
          timeout: 5000,
        });
        console.log('✅ Database is ready');
        return true;
      } catch {
        // Fallback to direct connection test
        const url = new URL(databaseUrl);
        execSync(`pg_isready -h ${url.hostname} -p ${url.port} -U ${url.username}`, {
          stdio: 'ignore',
          timeout: 5000,
        });
        console.log('✅ Database is ready');
        return true;
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error(`❌ Database not ready after ${maxAttempts} attempts`);
        throw new Error('Database connection timeout');
      }

      console.log(`⏳ Waiting for database... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  waitForDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { waitForDatabase };
