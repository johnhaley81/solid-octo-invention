import { beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/solid_octo_invention_test';

let pool: pg.Pool;

beforeAll(async () => {
  // Create connection pool
  pool = new pg.Pool({
    connectionString: TEST_DATABASE_URL,
    max: 10,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Test database connection established');

    // Check if schema exists, if not create it
    const schemaCheck = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('public', 'app_private')
    `);

    const existingSchemas = schemaCheck.rows.map(row => row.schema_name);

    if (!existingSchemas.includes('app_private')) {
      console.log('🔧 Setting up test database schema...');

      // Read and execute the migration file
      const migrationPath = join(process.cwd(), 'migrations', 'current.sql');
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Execute migration
      await pool.query(migrationSQL);
      console.log('✅ Test database schema created');
    } else {
      console.log('✅ Test database schema already exists');
    }

    // Verify critical tables exist
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
      UNION
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'app_private' AND table_name IN ('password_credentials', 'webauthn_credentials', 'otp_tokens', 'user_sessions')
    `);

    const existingTables = tableCheck.rows.map(row => row.table_name);
    const requiredTables = [
      'users',
      'password_credentials',
      'webauthn_credentials',
      'otp_tokens',
      'user_sessions',
    ];

    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }

    console.log('✅ All required tables exist');

    // Verify functions exist
    const functionCheck = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN ('register_user', 'verify_email', 'login_with_password', 'switch_auth_method', 'current_user_from_session', 'logout')
    `);

    const existingFunctions = functionCheck.rows.map(row => row.routine_name);
    const requiredFunctions = [
      'register_user',
      'verify_email',
      'login_with_password',
      'switch_auth_method',
      'current_user_from_session',
      'logout',
    ];

    const missingFunctions = requiredFunctions.filter(func => !existingFunctions.includes(func));

    if (missingFunctions.length > 0) {
      throw new Error(`Missing required functions: ${missingFunctions.join(', ')}`);
    }

    console.log('✅ All required functions exist');
  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  if (pool) {
    await pool.end();
    console.log('✅ Test database connection closed');
  }
});

// Export pool for use in tests
export { pool };
