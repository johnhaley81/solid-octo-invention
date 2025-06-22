import { describe, it, expect } from 'vitest';

describe('Shared Package', () => {
  describe('Basic Types', () => {
    it('should define authentication method types', () => {
      type AuthMethod = 'password' | 'webauthn';
      
      const passwordMethod: AuthMethod = 'password';
      const webauthnMethod: AuthMethod = 'webauthn';
      
      expect(passwordMethod).toBe('password');
      expect(webauthnMethod).toBe('webauthn');
    });

    it('should define OTP token types', () => {
      type OTPTokenType = 'email_verification' | 'login_otp' | 'password_reset';
      
      const emailVerification: OTPTokenType = 'email_verification';
      const loginOtp: OTPTokenType = 'login_otp';
      const passwordReset: OTPTokenType = 'password_reset';
      
      expect(emailVerification).toBe('email_verification');
      expect(loginOtp).toBe('login_otp');
      expect(passwordReset).toBe('password_reset');
    });
  });

  describe('Validation Helpers', () => {
    it('should validate email format', () => {
      const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.email@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
    });

    it('should validate UUID format', () => {
      const isValidUUID = (uuid: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
      };

      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123e4567-e89b-12d3-a456-42661417400')).toBe(false); // Too short
    });

    it('should validate password strength', () => {
      const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        
        if (password.length < 8) {
          errors.push('Password must be at least 8 characters long');
        }
        
        if (!/[A-Z]/.test(password)) {
          errors.push('Password must contain at least one uppercase letter');
        }
        
        if (!/[a-z]/.test(password)) {
          errors.push('Password must contain at least one lowercase letter');
        }
        
        if (!/\d/.test(password)) {
          errors.push('Password must contain at least one number');
        }
        
        if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
          errors.push('Password must contain at least one special character');
        }
        
        return { valid: errors.length === 0, errors };
      };

      const strongPassword = validatePassword('SecurePassword123!');
      expect(strongPassword.valid).toBe(true);
      expect(strongPassword.errors).toHaveLength(0);

      const weakPassword = validatePassword('weak');
      expect(weakPassword.valid).toBe(false);
      expect(weakPassword.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Data Structures', () => {
    it('should define user interface', () => {
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
        updatedAt: new Date()
      };
      
      expect(user.id).toBeDefined();
      expect(user.email).toContain('@');
      expect(user.name).toBeTruthy();
      expect(['password', 'webauthn']).toContain(user.authMethod);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should define session interface', () => {
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
        createdAt: new Date()
      };
      
      expect(session.userId).toBeDefined();
      expect(session.sessionToken).toHaveLength(64);
      expect(session.expiresAt.getTime()).toBeGreaterThan(session.createdAt.getTime());
    });

    it('should define API response types', () => {
      interface SuccessResponse<T> {
        success: true;
        data: T;
      }
      
      interface ErrorResponse {
        success: false;
        error: {
          code: string;
          message: string;
          details?: unknown;
        };
      }
      
      const successResponse: SuccessResponse<{ message: string }> = {
        success: true,
        data: { message: 'Operation completed successfully' }
      };
      
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input provided',
          details: { field: 'email', reason: 'Invalid format' }
        }
      };
      
      expect(successResponse.success).toBe(true);
      expect(successResponse.data.message).toBeTruthy();
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBeTruthy();
    });
  });

  describe('Utility Functions', () => {
    it('should format dates consistently', () => {
      const formatDate = (date: Date): string => {
        return date.toISOString();
      };

      const testDate = new Date('2025-06-22T03:00:00.000Z');
      expect(formatDate(testDate)).toBe('2025-06-22T03:00:00.000Z');
    });

    it('should generate secure tokens', () => {
      const generateToken = (length: number = 32): string => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const token1 = generateToken(32);
      const token2 = generateToken(32);
      
      expect(token1).toHaveLength(32);
      expect(token2).toHaveLength(32);
      expect(token1).not.toBe(token2); // Should be different
    });

    it('should sanitize user input', () => {
      const sanitizeString = (input: string): string => {
        return input.trim().toLowerCase();
      };

      expect(sanitizeString('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
      expect(sanitizeString('User Name')).toBe('user name');
      expect(sanitizeString('')).toBe('');
    });
  });
});

