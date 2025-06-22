// Test setup and configuration

// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables for testing
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'auth_system_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'password';

process.env.SESSION_SECRET = 'test-session-secret';
process.env.WEBAUTHN_RP_NAME = 'Test Auth System';
process.env.WEBAUTHN_RP_ID = 'localhost';
process.env.WEBAUTHN_EXPECTED_ORIGIN = 'http://localhost:3000';

// Mock email service to prevent actual emails during testing
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test-password';
process.env.FROM_EMAIL = 'test@example.com';

// Global test setup
beforeAll(async () => {
  console.log('🧪 Setting up test environment...');
  
  // You might want to set up a test database here
  // or mock database operations for unit tests
});

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up test database or close connections
});

// Global test utilities
global.testUtils = {
  // Helper to create test user data
  createTestUser: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'TestPass123!',
    ...overrides
  }),
  
  // Helper to create WebAuthn test data
  createWebAuthnTestData: () => ({
    email: 'webauthn@example.com',
    registrationResponse: {
      id: 'test-credential-id',
      rawId: 'dGVzdC1jcmVkZW50aWFsLWlk',
      response: {
        clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIiwiY2hhbGxlbmdlIjoidGVzdC1jaGFsbGVuZ2UiLCJvcmlnaW4iOiJodHRwOi8vbG9jYWxob3N0OjMwMDAifQ',
        attestationObject: 'test-attestation-object',
        transports: ['internal']
      },
      type: 'public-key'
    }
  }),
  
  // Helper to wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to generate random email
  randomEmail: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`,
  
  // Helper to generate strong password
  strongPassword: () => 'TestPass123!' + Math.random().toString(36).substr(2, 5)
};

// Mock nodemailer for testing
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock WebAuthn server functions for testing
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(() => ({
    challenge: 'test-challenge',
    rp: { name: 'Test App', id: 'localhost' },
    user: { id: 'test-user-id', name: 'test@example.com', displayName: 'test@example.com' },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    timeout: 60000,
    attestation: 'none'
  })),
  
  verifyRegistrationResponse: jest.fn(() => ({
    verified: true,
    registrationInfo: {
      credentialID: Buffer.from('test-credential-id'),
      credentialPublicKey: Buffer.from('test-public-key'),
      counter: 0,
      credentialDeviceType: 'platform',
      credentialBackedUp: false
    }
  })),
  
  generateAuthenticationOptions: jest.fn(() => ({
    challenge: 'test-challenge',
    timeout: 60000,
    rpId: 'localhost',
    allowCredentials: [{
      id: 'test-credential-id',
      type: 'public-key',
      transports: ['internal']
    }],
    userVerification: 'preferred'
  })),
  
  verifyAuthenticationResponse: jest.fn(() => ({
    verified: true,
    authenticationInfo: {
      newCounter: 1
    }
  }))
}));

// Console override for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress console.error and console.warn during tests unless explicitly needed
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console functions
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Custom matchers for better test assertions
expect.extend({
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },
  
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  toHaveValidAuthResponse(received) {
    const hasSuccess = typeof received.success === 'boolean';
    const hasMessage = typeof received.message === 'string';
    const hasData = received.data !== undefined;
    
    const pass = hasSuccess && hasMessage;
    
    if (pass) {
      return {
        message: () => `expected response not to have valid auth structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected response to have valid auth structure (success, message, data)`,
        pass: false,
      };
    }
  }
});

console.log('✅ Test setup completed');

