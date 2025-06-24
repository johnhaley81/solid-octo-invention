#!/usr/bin/env tsx

/**
 * GraphQL Schema Generation Script
 *
 * This script generates the GraphQL schema by starting a temporary PostGraphile instance
 * and exporting the schema to a file. It's designed to be used in CI environments
 * to ensure schema stability.
 */

import { createServer } from 'http';
import { postgraphile } from 'postgraphile';
import { Pool } from 'pg';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import PgOmitArchivedPlugin from '@graphile-contrib/pg-omit-archived';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/solid_octo_invention';
const SCHEMA_OUTPUT_PATH = join(__dirname, '..', 'schema.graphql');

async function generateSchema(): Promise<void> {
  console.log('🚀 Starting GraphQL schema generation...');
  console.log(`📊 Database URL: ${DATABASE_URL.replace(/:[^:@]*@/, ':***@')}`);
  console.log(`📁 Output path: ${SCHEMA_OUTPUT_PATH}`);

  // Test database connection first
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }

  // Create PostGraphile instance with schema export
  const middleware = postgraphile(DATABASE_URL, 'app_public', {
    watchPg: false,
    graphiql: false,
    enhanceGraphiql: false,
    subscriptions: false,
    dynamicJson: true,
    setofFunctionsContainNulls: false,
    ignoreRBAC: false,
    showErrorStack: 'json',
    extendedErrors: ['hint', 'detail', 'errcode'],
    appendPlugins: [PgOmitArchivedPlugin],
    graphileBuildOptions: {
      // Configure pg-omit-archived plugin to use deleted_at column
      pgArchivedColumnName: 'deleted_at',
      pgArchivedColumnImpliesVisible: false, // deleted_at IS NOT NULL means hidden
      pgArchivedRelations: true, // Also apply to related records
      pgArchivedDefault: 'NO', // Exclude soft-deleted records by default
    },
    exportGqlSchemaPath: SCHEMA_OUTPUT_PATH,
    sortExport: true,
    legacyRelations: 'omit',
    pgSettings: _req => ({
      // Set PostgreSQL settings based on request context
      role: 'postgres', // This will be enhanced with proper authentication
    }),
  });

  // Create a temporary HTTP server to initialize PostGraphile
  const server = createServer(middleware);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Schema generation timed out after 30 seconds'));
    }, 30000);

    server.listen(0, () => {
      console.log('🔧 PostGraphile instance started, generating schema...');

      // Give PostGraphile time to generate the schema
      setTimeout(() => {
        clearTimeout(timeout);
        server.close(() => {
          if (existsSync(SCHEMA_OUTPUT_PATH)) {
            console.log('✅ GraphQL schema generated successfully!');
            console.log(
              `📊 Schema file size: ${require('fs').statSync(SCHEMA_OUTPUT_PATH).size} bytes`,
            );
            resolve();
          } else {
            reject(new Error('Schema file was not generated'));
          }
        });
      }, 5000);
    });

    server.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSchema()
    .then(() => {
      console.log('🎉 Schema generation completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Schema generation failed:', error);
      process.exit(1);
    });
}

export { generateSchema };
