import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pg from 'pg';
import request from 'supertest';
import express from 'express';
import { postgraphile } from 'postgraphile';

// Test database configuration
const TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/solid_octo_invention_test';

// Create test app with PostGraphile
const createTestApp = () => {
  const app = express();

  app.use(
    postgraphile(TEST_DATABASE_URL, 'public', {
      graphiql: false,
      enhanceGraphiql: false,
      subscriptions: false,
      watchPg: false,
      dynamicJson: true,
      setofFunctionsContainNulls: false,
      ignoreRBAC: false,
      showErrorStack: 'json',
      extendedErrors: ['hint', 'detail', 'errcode'],
      appendPlugins: [],
      exportGqlSchemaPath: null,
      graphqlRoute: '/graphql',
      graphiqlRoute: null,
      bodySizeLimit: '100kB',
      enableCors: true,
      legacyRelations: 'omit',
      pgSettings: {
        statement_timeout: '30s',
      },
    }),
  );

  return app;
};

describe('GraphQL Authentication API', () => {
  let app: express.Application;
  let pool: pg.Pool;

  beforeEach(async () => {
    app = createTestApp();
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
    // Clean up after each test
    await pool.query('DELETE FROM app_private.user_sessions');
    await pool.query('DELETE FROM app_private.otp_tokens');
    await pool.query('DELETE FROM app_private.webauthn_credentials');
    await pool.query('DELETE FROM app_private.password_credentials');
    await pool.query('DELETE FROM public.users');
    await pool.end();
  });

  describe('User Registration Mutation', () => {
    it('should register a new user via GraphQL', async () => {
      const mutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUserWithPassword(input: { email: $email, name: $name, password: $password }) {
            user {
              id
              email
              name
              authMethod
              createdAt
            }
          }
        }
      `;

      const variables = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePassword123!',
      };

      const response = await request(app)
        .post('/graphql')
        .send({ query: mutation, variables })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.registerUserWithPassword.user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
        authMethod: 'PASSWORD',
      });
      expect(response.body.data.registerUserWithPassword.user.id).toBeDefined();
      expect(response.body.data.registerUserWithPassword.user.createdAt).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      const mutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUser(input: { email: $email, name: $name, password: $password }) {
            id
            email
          }
        }
      `;

      const variables = {
        email: 'duplicate@example.com',
        name: 'Test User',
        password: 'SecurePassword123!',
      };

      // First registration should succeed
      await request(app).post('/graphql').send({ query: mutation, variables }).expect(200);

      // Second registration should fail
      const response = await request(app)
        .post('/graphql')
        .send({ query: mutation, variables })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('duplicate');
    });

    it('should validate password strength', async () => {
      const mutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUser(input: { email: $email, name: $name, password: $password }) {
            id
          }
        }
      `;

      const variables = {
        email: 'weak@example.com',
        name: 'Test User',
        password: 'weak', // Too weak
      };

      const response = await request(app)
        .post('/graphql')
        .send({ query: mutation, variables })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('password');
    });
  });

  describe('Email Verification Mutation', () => {
    it('should verify email with valid token', async () => {
      // First register a user
      const registerMutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUser(input: { email: $email, name: $name, password: $password }) {
            id
          }
        }
      `;

      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: registerMutation,
          variables: {
            email: 'verify@example.com',
            name: 'Verify User',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      const userId = registerResponse.body.data.registerUser.id;

      // Get the verification token from database
      const tokenResult = await pool.query(
        'SELECT token FROM app_private.otp_tokens WHERE user_id = $1 AND token_type = $2',
        [userId, 'email_verification'],
      );

      const token = tokenResult.rows[0].token;

      // Now verify the email
      const verifyMutation = `
        mutation VerifyEmail($token: String!) {
          verifyEmail(input: { token: $token })
        }
      `;

      const verifyResponse = await request(app)
        .post('/graphql')
        .send({
          query: verifyMutation,
          variables: { token },
        })
        .expect(200);

      expect(verifyResponse.body.errors).toBeUndefined();
      expect(verifyResponse.body.data.verifyEmail).toBe(true);
    });

    it('should reject invalid verification token', async () => {
      const mutation = `
        mutation VerifyEmail($token: String!) {
          verifyEmail(input: { token: $token })
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({
          query: mutation,
          variables: { token: 'invalid-token' },
        })
        .expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.verifyEmail).toBe(false);
    });
  });

  describe('Login Mutation', () => {
    it('should login with correct credentials after verification', async () => {
      // Register user
      const registerMutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUser(input: { email: $email, name: $name, password: $password }) {
            id
          }
        }
      `;

      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: registerMutation,
          variables: {
            email: 'login@example.com',
            name: 'Login User',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      const userId = registerResponse.body.data.registerUser.id;

      // Get and use verification token
      const tokenResult = await pool.query(
        'SELECT token FROM app_private.otp_tokens WHERE user_id = $1 AND token_type = $2',
        [userId, 'email_verification'],
      );

      await pool.query('SELECT verify_email($1)', [tokenResult.rows[0].token]);

      // Now login
      const loginMutation = `
        mutation LoginWithPassword($email: String!, $password: String!) {
          loginWithPassword(input: { email: $email, password: $password }) {
            userId
            sessionToken
            expiresAt
          }
        }
      `;

      const loginResponse = await request(app)
        .post('/graphql')
        .send({
          query: loginMutation,
          variables: {
            email: 'login@example.com',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      expect(loginResponse.body.errors).toBeUndefined();
      expect(loginResponse.body.data.loginWithPassword).toMatchObject({
        userId: expect.any(String),
        sessionToken: expect.any(String),
        expiresAt: expect.any(String),
      });
    });

    it('should reject login before email verification', async () => {
      // Register user but don't verify
      const registerMutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUser(input: { email: $email, name: $name, password: $password }) {
            id
          }
        }
      `;

      await request(app)
        .post('/graphql')
        .send({
          query: registerMutation,
          variables: {
            email: 'unverified@example.com',
            name: 'Unverified User',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      // Try to login without verification
      const loginMutation = `
        mutation LoginWithPassword($email: String!, $password: String!) {
          loginWithPassword(input: { email: $email, password: $password }) {
            userId
          }
        }
      `;

      const loginResponse = await request(app)
        .post('/graphql')
        .send({
          query: loginMutation,
          variables: {
            email: 'unverified@example.com',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      expect(loginResponse.body.errors).toBeDefined();
      expect(loginResponse.body.errors[0].message).toContain('verified');
    });

    it('should reject login with wrong password', async () => {
      // Register and verify user
      const registerMutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUser(input: { email: $email, name: $name, password: $password }) {
            id
          }
        }
      `;

      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: registerMutation,
          variables: {
            email: 'wrongpass@example.com',
            name: 'Wrong Pass User',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      const userId = registerResponse.body.data.registerUser.id;

      const tokenResult = await pool.query(
        'SELECT token FROM app_private.otp_tokens WHERE user_id = $1 AND token_type = $2',
        [userId, 'email_verification'],
      );

      await pool.query('SELECT verify_email($1)', [tokenResult.rows[0].token]);

      // Try to login with wrong password
      const loginMutation = `
        mutation LoginWithPassword($email: String!, $password: String!) {
          loginWithPassword(input: { email: $email, password: $password }) {
            userId
          }
        }
      `;

      const loginResponse = await request(app)
        .post('/graphql')
        .send({
          query: loginMutation,
          variables: {
            email: 'wrongpass@example.com',
            password: 'WrongPassword!',
          },
        })
        .expect(200);

      expect(loginResponse.body.errors).toBeDefined();
      expect(loginResponse.body.errors[0].message).toContain('Invalid');
    });
  });

  describe('Switch Authentication Method Mutation', () => {
    it('should switch from password to webauthn', async () => {
      // Register user
      const registerMutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUser(input: { email: $email, name: $name, password: $password }) {
            id
          }
        }
      `;

      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: registerMutation,
          variables: {
            email: 'switch@example.com',
            name: 'Switch User',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      const userId = registerResponse.body.data.registerUser.id;

      // Switch to WebAuthn
      const switchMutation = `
        mutation SwitchAuthMethod($userId: UUID!, $newMethod: AuthMethod!) {
          switchAuthMethod(input: { userId: $userId, newMethod: $newMethod }) {
            id
            authMethod
          }
        }
      `;

      const switchResponse = await request(app)
        .post('/graphql')
        .send({
          query: switchMutation,
          variables: {
            userId,
            newMethod: 'WEBAUTHN',
          },
        })
        .expect(200);

      expect(switchResponse.body.errors).toBeUndefined();
      expect(switchResponse.body.data.switchAuthMethod).toMatchObject({
        id: userId,
        authMethod: 'WEBAUTHN',
      });
    });
  });

  describe('Session Management', () => {
    it('should retrieve current user from session', async () => {
      // Register, verify, and login user
      const registerMutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUser(input: { email: $email, name: $name, password: $password }) {
            id
          }
        }
      `;

      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: registerMutation,
          variables: {
            email: 'session@example.com',
            name: 'Session User',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      const userId = registerResponse.body.data.registerUser.id;

      const tokenResult = await pool.query(
        'SELECT token FROM app_private.otp_tokens WHERE user_id = $1 AND token_type = $2',
        [userId, 'email_verification'],
      );

      await pool.query('SELECT verify_email($1)', [tokenResult.rows[0].token]);

      const loginMutation = `
        mutation LoginWithPassword($email: String!, $password: String!) {
          loginWithPassword(input: { email: $email, password: $password }) {
            sessionToken
          }
        }
      `;

      const loginResponse = await request(app)
        .post('/graphql')
        .send({
          query: loginMutation,
          variables: {
            email: 'session@example.com',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      const sessionToken = loginResponse.body.data.loginWithPassword.sessionToken;

      // Get current user from session
      const currentUserMutation = `
        mutation CurrentUserFromSession($sessionToken: String!) {
          currentUserFromSession(input: { sessionToken: $sessionToken }) {
            id
            email
            name
            authMethod
          }
        }
      `;

      const currentUserResponse = await request(app)
        .post('/graphql')
        .send({
          query: currentUserMutation,
          variables: { sessionToken },
        })
        .expect(200);

      expect(currentUserResponse.body.errors).toBeUndefined();
      expect(currentUserResponse.body.data.currentUserFromSession).toMatchObject({
        id: userId,
        email: 'session@example.com',
        name: 'Session User',
        authMethod: 'PASSWORD',
      });
    });

    it('should logout and invalidate session', async () => {
      // Register, verify, and login user
      const registerMutation = `
        mutation RegisterUser($email: String!, $name: String!, $password: String!) {
          registerUser(input: { email: $email, name: $name, password: $password }) {
            id
          }
        }
      `;

      const registerResponse = await request(app)
        .post('/graphql')
        .send({
          query: registerMutation,
          variables: {
            email: 'logout@example.com',
            name: 'Logout User',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      const userId = registerResponse.body.data.registerUser.id;

      const tokenResult = await pool.query(
        'SELECT token FROM app_private.otp_tokens WHERE user_id = $1 AND token_type = $2',
        [userId, 'email_verification'],
      );

      await pool.query('SELECT verify_email($1)', [tokenResult.rows[0].token]);

      const loginMutation = `
        mutation LoginWithPassword($email: String!, $password: String!) {
          loginWithPassword(input: { email: $email, password: $password }) {
            sessionToken
          }
        }
      `;

      const loginResponse = await request(app)
        .post('/graphql')
        .send({
          query: loginMutation,
          variables: {
            email: 'logout@example.com',
            password: 'SecurePassword123!',
          },
        })
        .expect(200);

      const sessionToken = loginResponse.body.data.loginWithPassword.sessionToken;

      // Logout
      const logoutMutation = `
        mutation Logout($sessionToken: String!) {
          logout(input: { sessionToken: $sessionToken })
        }
      `;

      const logoutResponse = await request(app)
        .post('/graphql')
        .send({
          query: logoutMutation,
          variables: { sessionToken },
        })
        .expect(200);

      expect(logoutResponse.body.errors).toBeUndefined();
      expect(logoutResponse.body.data.logout).toBe(true);

      // Try to use session after logout
      const currentUserMutation = `
        mutation CurrentUserFromSession($sessionToken: String!) {
          currentUserFromSession(input: { sessionToken: $sessionToken }) {
            id
          }
        }
      `;

      const currentUserResponse = await request(app)
        .post('/graphql')
        .send({
          query: currentUserMutation,
          variables: { sessionToken },
        })
        .expect(200);

      expect(currentUserResponse.body.errors).toBeUndefined();
      expect(currentUserResponse.body.data.currentUserFromSession).toBeNull();
    });
  });

  describe('GraphQL Schema Validation', () => {
    it('should expose correct authentication mutations', async () => {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            mutationType {
              fields {
                name
                description
                args {
                  name
                  type {
                    name
                    kind
                  }
                }
              }
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: introspectionQuery })
        .expect(200);

      expect(response.body.errors).toBeUndefined();

      const mutations = response.body.data.__schema.mutationType.fields;
      const authMutations = mutations.filter((field: any) =>
        [
          'registerUser',
          'verifyEmail',
          'loginWithPassword',
          'switchAuthMethod',
          'logout',
          'currentUserFromSession',
        ].includes(field.name),
      );

      expect(authMutations.length).toBeGreaterThan(0);

      // Check that registerUser mutation exists with correct args
      const registerUser = authMutations.find((m: any) => m.name === 'registerUser');
      expect(registerUser).toBeDefined();
      expect(registerUser.args).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'input' })]),
      );
    });

    it('should expose correct enum types', async () => {
      const enumQuery = `
        query EnumTypes {
          __schema {
            types {
              name
              kind
              enumValues {
                name
              }
            }
          }
        }
      `;

      const response = await request(app).post('/graphql').send({ query: enumQuery }).expect(200);

      expect(response.body.errors).toBeUndefined();

      const types = response.body.data.__schema.types;
      const authMethodEnum = types.find((type: any) => type.name === 'AuthMethod');

      expect(authMethodEnum).toBeDefined();
      expect(authMethodEnum.kind).toBe('ENUM');
      expect(authMethodEnum.enumValues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'PASSWORD' }),
          expect.objectContaining({ name: 'WEBAUTHN' }),
        ]),
      );
    });
  });
});
