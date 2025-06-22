import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pg from 'pg';

const TEST_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/solid_octo_invention_test';

describe('Authentication Integration Tests', () => {
  let pool: pg.Pool;

  beforeEach(async () => {
    pool = new pg.Pool({
      connectionString: TEST_DATABASE_URL,
      max: 5,
    });

    // Clean up test data
    await pool.query('DELETE FROM app_private.user_sessions');
    await pool.query('DELETE FROM app_private.otp_tokens');
    await pool.query('DELETE FROM app_private.webauthn_credentials');
    await pool.query('DELETE FROM app_private.password_credentials');
    await pool.query('DELETE FROM public.users');
  });

  afterEach(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe('Database Schema', () => {
    it('should have all required tables', async () => {
      const result = await pool.query(`
        SELECT table_name, table_schema
        FROM information_schema.tables 
        WHERE (table_schema = 'public' AND table_name = 'users')
        OR (table_schema = 'app_private' AND table_name IN ('password_credentials', 'webauthn_credentials', 'otp_tokens', 'user_sessions'))
        ORDER BY table_schema, table_name
      `);

      const tables = result.rows.map(row => `${row.table_schema}.${row.table_name}`);
      
      expect(tables).toContain('public.users');
      expect(tables).toContain('app_private.password_credentials');
      expect(tables).toContain('app_private.webauthn_credentials');
      expect(tables).toContain('app_private.otp_tokens');
      expect(tables).toContain('app_private.user_sessions');
    });

    it('should have all required functions', async () => {
      const result = await pool.query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name IN ('register_user', 'verify_email', 'login_with_password', 'switch_auth_method', 'current_user_from_session', 'logout')
        ORDER BY routine_name
      `);

      const functions = result.rows.map(row => row.routine_name);
      
      expect(functions).toContain('register_user');
      expect(functions).toContain('verify_email');
      expect(functions).toContain('login_with_password');
      expect(functions).toContain('switch_auth_method');
      expect(functions).toContain('current_user_from_session');
      expect(functions).toContain('logout');
    });

    it('should have correct enum types', async () => {
      const authMethodResult = await pool.query(`
        SELECT unnest(enum_range(NULL::auth_method)) as value
      `);
      
      const tokenTypeResult = await pool.query(`
        SELECT unnest(enum_range(NULL::otp_token_type)) as value
      `);

      const authMethods = authMethodResult.rows.map(row => row.value);
      const tokenTypes = tokenTypeResult.rows.map(row => row.value);
      
      expect(authMethods).toEqual(['password', 'webauthn']);
      expect(tokenTypes).toEqual(['email_verification', 'login_otp', 'password_reset']);
    });
  });

  describe('Basic Authentication Flow', () => {
    it('should complete full registration and login flow', async () => {
      // 1. Register user
      const registerResult = await pool.query(
        'SELECT register_user($1, $2, $3) as user_data',
        ['integration@example.com', 'Integration Test', 'SecurePassword123!'],
      );

      const user = registerResult.rows[0].user_data;
      expect(user).toMatchObject({
        email: 'integration@example.com',
        name: 'Integration Test',
        auth_method: 'password',
      });

      // 2. Get verification token
      const tokenResult = await pool.query(
        'SELECT token FROM app_private.otp_tokens WHERE user_id = $1 AND token_type = $2',
        [user.id, 'email_verification'],
      );

      expect(tokenResult.rows).toHaveLength(1);
      const verificationToken = tokenResult.rows[0].token;

      // 3. Verify email
      const verifyResult = await pool.query(
        'SELECT verify_email($1) as verified',
        [verificationToken],
      );

      expect(verifyResult.rows[0].verified).toBe(true);

      // 4. Login
      const loginResult = await pool.query(
        'SELECT * FROM login_with_password($1, $2)',
        ['integration@example.com', 'SecurePassword123!'],
      );

      expect(loginResult.rows).toHaveLength(1);
      const session = loginResult.rows[0];
      expect(session).toMatchObject({
        user_id: user.id,
        session_token: expect.any(String),
        expires_at: expect.any(Date),
      });

      // 5. Get current user from session
      const currentUserResult = await pool.query(
        'SELECT current_user_from_session($1) as user_data',
        [session.session_token],
      );

      expect(currentUserResult.rows[0].user_data).toMatchObject({
        id: user.id,
        email: 'integration@example.com',
        name: 'Integration Test',
      });

      // 6. Logout
      const logoutResult = await pool.query(
        'SELECT logout($1) as success',
        [session.session_token],
      );

      expect(logoutResult.rows[0].success).toBe(true);

      // 7. Verify session is invalid
      const invalidSessionResult = await pool.query(
        'SELECT current_user_from_session($1) as user_data',
        [session.session_token],
      );

      expect(invalidSessionResult.rows[0].user_data).toBeNull();
    });

    it('should handle authentication method switching', async () => {
      // Register user with password auth
      const registerResult = await pool.query(
        'SELECT register_user($1, $2, $3) as user_data',
        ['switch@example.com', 'Switch Test', 'SecurePassword123!'],
      );

      const user = registerResult.rows[0].user_data;

      // Verify password credentials exist
      const passwordCredResult = await pool.query(
        'SELECT * FROM app_private.password_credentials WHERE user_id = $1',
        [user.id],
      );

      expect(passwordCredResult.rows).toHaveLength(1);

      // Switch to WebAuthn
      const switchResult = await pool.query(
        'SELECT switch_auth_method($1, $2) as user_data',
        [user.id, 'webauthn'],
      );

      expect(switchResult.rows[0].user_data.auth_method).toBe('webauthn');

      // Verify password credentials were cleaned up
      const cleanedCredResult = await pool.query(
        'SELECT * FROM app_private.password_credentials WHERE user_id = $1',
        [user.id],
      );

      expect(cleanedCredResult.rows).toHaveLength(0);

      // Switch back to password
      const switchBackResult = await pool.query(
        'SELECT switch_auth_method($1, $2) as user_data',
        [user.id, 'password'],
      );

      expect(switchBackResult.rows[0].user_data.auth_method).toBe('password');
    });
  });

  describe('Error Handling', () => {
    it('should prevent duplicate email registration', async () => {
      // Register first user
      await pool.query(
        'SELECT register_user($1, $2, $3)',
        ['duplicate@example.com', 'First User', 'Password123!'],
      );

      // Try to register with same email
      await expect(
        pool.query(
          'SELECT register_user($1, $2, $3)',
          ['duplicate@example.com', 'Second User', 'Password456!'],
        ),
      ).rejects.toThrow();
    });

    it('should reject login before email verification', async () => {
      // Register user but don't verify
      await pool.query(
        'SELECT register_user($1, $2, $3)',
        ['unverified@example.com', 'Unverified User', 'Password123!'],
      );

      // Try to login without verification
      await expect(
        pool.query(
          'SELECT * FROM login_with_password($1, $2)',
          ['unverified@example.com', 'Password123!'],
        ),
      ).rejects.toThrow();
    });

    it('should reject invalid verification tokens', async () => {
      const result = await pool.query(
        'SELECT verify_email($1) as verified',
        ['invalid-token-12345'],
      );

      expect(result.rows[0].verified).toBe(false);
    });

    it('should track failed login attempts', async () => {
      // Register and verify user
      const registerResult = await pool.query(
        'SELECT register_user($1, $2, $3) as user_data',
        ['failedlogin@example.com', 'Failed Login Test', 'CorrectPassword123!'],
      );

      const user = registerResult.rows[0].user_data;

      const tokenResult = await pool.query(
        'SELECT token FROM app_private.otp_tokens WHERE user_id = $1 AND token_type = $2',
        [user.id, 'email_verification'],
      );

      await pool.query('SELECT verify_email($1)', [tokenResult.rows[0].token]);

      // Make failed login attempts
      for (let i = 0; i < 3; i++) {
        try {
          await pool.query(
            'SELECT * FROM login_with_password($1, $2)',
            ['failedlogin@example.com', 'WrongPassword'],
          );
        } catch {
          // Expected to fail
        }
      }

      // Check failed attempts count
      const credResult = await pool.query(
        'SELECT failed_login_attempts FROM app_private.password_credentials WHERE user_id = $1',
        [user.id],
      );

      expect(credResult.rows[0].failed_login_attempts).toBe(3);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity', async () => {
      // Register user
      const registerResult = await pool.query(
        'SELECT register_user($1, $2, $3) as user_data',
        ['integrity@example.com', 'Integrity Test', 'Password123!'],
      );

      const user = registerResult.rows[0].user_data;

      // Verify related records were created
      const passwordCredResult = await pool.query(
        'SELECT * FROM app_private.password_credentials WHERE user_id = $1',
        [user.id],
      );

      const otpTokenResult = await pool.query(
        'SELECT * FROM app_private.otp_tokens WHERE user_id = $1',
        [user.id],
      );

      expect(passwordCredResult.rows).toHaveLength(1);
      expect(otpTokenResult.rows).toHaveLength(1);

      // Try to delete user (should fail due to foreign key constraints)
      await expect(
        pool.query('DELETE FROM public.users WHERE id = $1', [user.id]),
      ).rejects.toThrow();
    });

    it('should enforce mutual exclusivity via triggers', async () => {
      // Register user
      const registerResult = await pool.query(
        'SELECT register_user($1, $2, $3) as user_data',
        ['exclusivity@example.com', 'Exclusivity Test', 'Password123!'],
      );

      const user = registerResult.rows[0].user_data;

      // Switch to WebAuthn (should clean up password credentials)
      await pool.query(
        'SELECT switch_auth_method($1, $2)',
        [user.id, 'webauthn'],
      );

      // Verify password credentials were removed
      const passwordCredResult = await pool.query(
        'SELECT * FROM app_private.password_credentials WHERE user_id = $1',
        [user.id],
      );

      expect(passwordCredResult.rows).toHaveLength(0);

      // Add a WebAuthn credential
      await pool.query(
        `INSERT INTO app_private.webauthn_credentials 
         (user_id, credential_id, public_key, counter, device_type) 
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, 'test-cred-id', 'test-public-key', 0, 'platform'],
      );

      // Switch back to password (should clean up WebAuthn credentials)
      await pool.query(
        'SELECT switch_auth_method($1, $2)',
        [user.id, 'password'],
      );

      // Verify WebAuthn credentials were removed
      const webauthnCredResult = await pool.query(
        'SELECT * FROM app_private.webauthn_credentials WHERE user_id = $1',
        [user.id],
      );

      expect(webauthnCredResult.rows).toHaveLength(0);
    });
  });
});
