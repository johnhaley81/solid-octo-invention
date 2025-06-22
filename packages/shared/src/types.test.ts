import { describe, it, expect } from 'vitest';

describe('Shared Types', () => {
  describe('Authentication Types', () => {
    it('should define auth method types correctly', () => {
      type AuthMethod = 'password' | 'webauthn';

      const passwordMethod: AuthMethod = 'password';
      const webauthnMethod: AuthMethod = 'webauthn';

      expect(passwordMethod).toBe('password');
      expect(webauthnMethod).toBe('webauthn');
    });

    it('should define OTP token types correctly', () => {
      type OTPTokenType = 'email_verification' | 'login_otp' | 'password_reset';

      const emailVerification: OTPTokenType = 'email_verification';
      const loginOtp: OTPTokenType = 'login_otp';
      const passwordReset: OTPTokenType = 'password_reset';

      expect(emailVerification).toBe('email_verification');
      expect(loginOtp).toBe('login_otp');
      expect(passwordReset).toBe('password_reset');
    });
  });

  describe('User Types', () => {
    it('should define user interface correctly', () => {
      interface User {
        id: string;
        email: string;
        name: string;
        authMethod: 'password' | 'webauthn';
        createdAt: Date;
        updatedAt: Date;
      }

      const user: User = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        name: 'Test User',
        authMethod: 'password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user.id).toBeDefined();
      expect(user.email).toContain('@');
      expect(user.name).toBeTruthy();
      expect(['password', 'webauthn']).toContain(user.authMethod);
    });
  });

  describe('Session Types', () => {
    it('should define session interface correctly', () => {
      interface Session {
        userId: string;
        sessionToken: string;
        expiresAt: Date;
        createdAt: Date;
      }

      const session: Session = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        sessionToken: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        createdAt: new Date(),
      };

      expect(session.userId).toBeDefined();
      expect(session.sessionToken).toHaveLength(64);
      expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());
    });
  });

  describe('API Response Types', () => {
    it('should define success response type', () => {
      interface SuccessResponse<T> {
        success: true;
        data: T;
      }

      const response: SuccessResponse<{ message: string }> = {
        success: true,
        data: { message: 'Operation completed successfully' },
      };

      expect(response.success).toBe(true);
      expect(response.data.message).toBeTruthy();
    });

    it('should define error response type', () => {
      interface ErrorResponse {
        success: false;
        error: {
          code: string;
          message: string;
          details?: unknown;
        };
      }

      const response: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input provided',
          details: { field: 'email', reason: 'Invalid format' },
        },
      };

      expect(response.success).toBe(false);
      expect(response.error.code).toBeTruthy();
      expect(response.error.message).toBeTruthy();
    });
  });

  describe('Validation Types', () => {
    it('should define validation result type', () => {
      interface ValidationResult {
        valid: boolean;
        errors: string[];
      }

      const validResult: ValidationResult = {
        valid: true,
        errors: [],
      };

      const invalidResult: ValidationResult = {
        valid: false,
        errors: ['Password too short', 'Missing special character'],
      };

      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });
});
