const request = require('supertest');
const app = require('../src/app');

describe('Authentication System', () => {
  let server;
  
  beforeAll(async () => {
    // Start test server
    server = app.listen(0); // Use random port
  });
  
  afterAll(async () => {
    // Close test server
    if (server) {
      server.close();
    }
  });

  describe('Health Check', () => {
    test('GET /api/health should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Authentication Endpoints', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'TestPass123!'
    };

    describe('Registration', () => {
      test('POST /api/auth/register should register new user', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(testUser)
          .expect(201);
        
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data.user).toHaveProperty('email', testUser.email);
        expect(response.body.data.user).toHaveProperty('authMethod', 'password');
        expect(response.body.data).toHaveProperty('requiresEmailVerification', true);
      });

      test('POST /api/auth/register should reject duplicate email', async () => {
        // Try to register same user again
        const response = await request(app)
          .post('/api/auth/register')
          .send(testUser)
          .expect(400);
        
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('already exists');
      });

      test('POST /api/auth/register should validate email format', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'invalid-email',
            password: 'TestPass123!'
          })
          .expect(400);
        
        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });

      test('POST /api/auth/register should validate password strength', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test2@example.com',
            password: 'weak'
          })
          .expect(400);
        
        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      });
    });

    describe('Login', () => {
      test('POST /api/auth/login should require OTP', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          })
          .expect(200);
        
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('requiresOTP', true);
      });

      test('POST /api/auth/login should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          })
          .expect(401);
        
        expect(response.body).toHaveProperty('error');
      });

      test('POST /api/auth/login should reject non-existent user', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'TestPass123!'
          })
          .expect(401);
        
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('Password Reset', () => {
      test('POST /api/auth/password-reset/request should accept any email', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({
            email: testUser.email
          })
          .expect(200);
        
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
      });

      test('POST /api/auth/password-reset/request should not reveal user existence', async () => {
        const response = await request(app)
          .post('/api/auth/password-reset/request')
          .send({
            email: 'nonexistent@example.com'
          })
          .expect(200);
        
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.message).toContain('If an account with this email exists');
      });
    });

    describe('WebAuthn Registration', () => {
      test('POST /api/auth/webauthn/register/begin should return registration options', async () => {
        const response = await request(app)
          .post('/api/auth/webauthn/register/begin')
          .send({
            email: 'webauthn@example.com'
          })
          .expect(200);
        
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('options');
        expect(response.body.options).toHaveProperty('challenge');
        expect(response.body.options).toHaveProperty('rp');
        expect(response.body.options).toHaveProperty('user');
      });

      test('POST /api/auth/webauthn/register/complete should require valid session', async () => {
        const response = await request(app)
          .post('/api/auth/webauthn/register/complete')
          .send({
            userId: 'invalid-uuid',
            registrationResponse: {}
          })
          .expect(400);
        
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('WebAuthn Authentication', () => {
      test('POST /api/auth/webauthn/authenticate/begin should reject non-webauthn user', async () => {
        const response = await request(app)
          .post('/api/auth/webauthn/authenticate/begin')
          .send({
            email: testUser.email // This user uses password auth
          })
          .expect(400);
        
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('WebAuthn not enabled');
      });
    });
  });

  describe('Protected Endpoints', () => {
    test('GET /api/auth/me should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);
      
      expect(response.body).toHaveProperty('code', 'AUTH_REQUIRED');
    });

    test('POST /api/user/change-password should require authentication', async () => {
      const response = await request(app)
        .post('/api/user/change-password')
        .send({
          currentPassword: 'old',
          newPassword: 'NewPass123!'
        })
        .expect(401);
      
      expect(response.body).toHaveProperty('code', 'AUTH_REQUIRED');
    });

    test('GET /api/user/profile should require authentication', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .expect(401);
      
      expect(response.body).toHaveProperty('code', 'AUTH_REQUIRED');
    });
  });

  describe('Rate Limiting', () => {
    test('Should enforce rate limits on auth endpoints', async () => {
      // Make multiple rapid requests to trigger rate limit
      const requests = Array(12).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrong'
          })
      );

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited
      const rateLimited = responses.some(response => response.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Input Validation', () => {
    test('Should validate email format in all endpoints', async () => {
      const endpoints = [
        '/api/auth/register',
        '/api/auth/login',
        '/api/auth/password-reset/request',
        '/api/auth/webauthn/register/begin',
        '/api/auth/webauthn/authenticate/begin'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .post(endpoint)
          .send({
            email: 'invalid-email',
            password: 'TestPass123!'
          });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
      }
    });

    test('Should reject empty requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    test('Should sanitize input data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: '  TEST@EXAMPLE.COM  ', // Should be trimmed and lowercased
          password: 'TestPass123!'
        })
        .expect(201);
      
      expect(response.body.data.user.email).toBe('test@example.com');
    });
  });

  describe('Security Headers', () => {
    test('Should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('Error Handling', () => {
    test('Should handle 404 for non-existent API endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);
      
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    test('Should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
});

