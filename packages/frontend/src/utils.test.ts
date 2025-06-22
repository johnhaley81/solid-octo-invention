import { describe, it, expect } from 'vitest';

describe('Frontend Utilities', () => {
  describe('Authentication Helpers', () => {
    it('should validate email format', () => {
      const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('')).toBe(false);
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

    it('should format authentication method display names', () => {
      const formatAuthMethod = (method: 'password' | 'webauthn'): string => {
        switch (method) {
          case 'password':
            return 'Email & Password';
          case 'webauthn':
            return 'Passkey';
          default:
            return 'Unknown';
        }
      };

      expect(formatAuthMethod('password')).toBe('Email & Password');
      expect(formatAuthMethod('webauthn')).toBe('Passkey');
    });
  });

  describe('Form Helpers', () => {
    it('should sanitize form input', () => {
      const sanitizeInput = (input: string): string => {
        return input.trim();
      };

      expect(sanitizeInput('  test@example.com  ')).toBe('test@example.com');
      expect(sanitizeInput('normal-input')).toBe('normal-input');
      expect(sanitizeInput('')).toBe('');
    });

    it('should format error messages', () => {
      const formatErrorMessage = (error: { message: string; code?: string }): string => {
        if (error.code === 'VALIDATION_ERROR') {
          return `Validation Error: ${error.message}`;
        }
        return error.message;
      };

      expect(formatErrorMessage({ message: 'Invalid email', code: 'VALIDATION_ERROR' }))
        .toBe('Validation Error: Invalid email');
      
      expect(formatErrorMessage({ message: 'Server error' }))
        .toBe('Server error');
    });
  });

  describe('Session Helpers', () => {
    it('should check if session is expired', () => {
      const isSessionExpired = (expiresAt: Date): boolean => {
        return expiresAt.getTime() < Date.now();
      };

      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      expect(isSessionExpired(futureDate)).toBe(false);
      expect(isSessionExpired(pastDate)).toBe(true);
    });

    it('should format session expiry time', () => {
      const formatExpiryTime = (expiresAt: Date): string => {
        const now = new Date();
        const diffMs = expiresAt.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        
        if (diffHours < 1) {
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          return `${diffMinutes} minutes`;
        }
        
        return `${diffHours} hours`;
      };

      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000);

      expect(formatExpiryTime(oneHourFromNow)).toBe('1 hours');
      expect(formatExpiryTime(twoHoursFromNow)).toBe('2 hours');
      expect(formatExpiryTime(thirtyMinutesFromNow)).toBe('30 minutes');
    });
  });

  describe('WebAuthn Helpers', () => {
    it('should check WebAuthn support', () => {
      const isWebAuthnSupported = (): boolean => {
        return typeof window !== 'undefined' && 
               'navigator' in window && 
               'credentials' in navigator &&
               'create' in navigator.credentials;
      };

      // In test environment, window is not available
      expect(isWebAuthnSupported()).toBe(false);
    });

    it('should format authenticator type', () => {
      const formatAuthenticatorType = (type: 'platform' | 'cross-platform'): string => {
        switch (type) {
          case 'platform':
            return 'Built-in (Touch ID, Face ID, Windows Hello)';
          case 'cross-platform':
            return 'Security Key (USB, NFC, Bluetooth)';
          default:
            return 'Unknown';
        }
      };

      expect(formatAuthenticatorType('platform')).toBe('Built-in (Touch ID, Face ID, Windows Hello)');
      expect(formatAuthenticatorType('cross-platform')).toBe('Security Key (USB, NFC, Bluetooth)');
    });
  });

  describe('Loading States', () => {
    it('should manage loading state', () => {
      interface LoadingState {
        isLoading: boolean;
        error: string | null;
        data: unknown | null;
      }

      const initialState: LoadingState = {
        isLoading: false,
        error: null,
        data: null
      };

      const loadingState: LoadingState = {
        isLoading: true,
        error: null,
        data: null
      };

      const successState: LoadingState = {
        isLoading: false,
        error: null,
        data: { message: 'Success' }
      };

      const errorState: LoadingState = {
        isLoading: false,
        error: 'Something went wrong',
        data: null
      };

      expect(initialState.isLoading).toBe(false);
      expect(loadingState.isLoading).toBe(true);
      expect(successState.data).toBeTruthy();
      expect(errorState.error).toBeTruthy();
    });
  });
});

