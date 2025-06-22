/**
 * Authentication error definitions using Effect-TS Data
 * Provides tagged errors for proper error handling
 */

import { Data } from 'effect';

// Base authentication error
export class AuthError extends Data.TaggedError('AuthError')<{
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}> {}

// Specific authentication errors
export class InvalidCredentialsError extends Data.TaggedError('InvalidCredentialsError')<{
  readonly message: string;
}> {}

export class EmailNotVerifiedError extends Data.TaggedError('EmailNotVerifiedError')<{
  readonly message: string;
  readonly email: string;
}> {}

export class AccountLockedError extends Data.TaggedError('AccountLockedError')<{
  readonly message: string;
  readonly lockedUntil: Date;
}> {}

export class OtpRequiredError extends Data.TaggedError('OtpRequiredError')<{
  readonly message: string;
}> {}

export class OtpInvalidError extends Data.TaggedError('OtpInvalidError')<{
  readonly message: string;
  readonly attemptsRemaining: number;
}> {}

export class OtpExpiredError extends Data.TaggedError('OtpExpiredError')<{
  readonly message: string;
}> {}

export class TokenInvalidError extends Data.TaggedError('TokenInvalidError')<{
  readonly message: string;
  readonly tokenType: string;
}> {}

export class TokenExpiredError extends Data.TaggedError('TokenExpiredError')<{
  readonly message: string;
  readonly tokenType: string;
}> {}

export class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  readonly message: string;
  readonly email?: string;
}> {}

export class UserExistsError extends Data.TaggedError('UserExistsError')<{
  readonly message: string;
  readonly email: string;
}> {}

export class WebAuthnNotSupportedError extends Data.TaggedError('WebAuthnNotSupportedError')<{
  readonly message: string;
}> {}

export class WebAuthnFailedError extends Data.TaggedError('WebAuthnFailedError')<{
  readonly message: string;
  readonly reason: string;
}> {}

export class AuthMethodMismatchError extends Data.TaggedError('AuthMethodMismatchError')<{
  readonly message: string;
  readonly expectedMethod: string;
  readonly actualMethod: string;
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string;
  readonly field: string;
  readonly errors: string[];
}> {}

export class RateLimitExceededError extends Data.TaggedError('RateLimitExceededError')<{
  readonly message: string;
  readonly retryAfter: number;
}> {}

export class SessionExpiredError extends Data.TaggedError('SessionExpiredError')<{
  readonly message: string;
}> {}

export class SessionInvalidError extends Data.TaggedError('SessionInvalidError')<{
  readonly message: string;
}> {}

export class PermissionDeniedError extends Data.TaggedError('PermissionDeniedError')<{
  readonly message: string;
  readonly resource: string;
}> {}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly message: string;
  readonly operation: string;
}> {}

export class EmailServiceError extends Data.TaggedError('EmailServiceError')<{
  readonly message: string;
  readonly emailType: string;
}> {}

export class ConfigurationError extends Data.TaggedError('ConfigurationError')<{
  readonly message: string;
  readonly setting: string;
}> {}

// Union type of all authentication errors
export type AuthenticationError =
  | AuthError
  | InvalidCredentialsError
  | EmailNotVerifiedError
  | AccountLockedError
  | OtpRequiredError
  | OtpInvalidError
  | OtpExpiredError
  | TokenInvalidError
  | TokenExpiredError
  | UserNotFoundError
  | UserExistsError
  | WebAuthnNotSupportedError
  | WebAuthnFailedError
  | AuthMethodMismatchError
  | ValidationError
  | RateLimitExceededError
  | SessionExpiredError
  | SessionInvalidError
  | PermissionDeniedError
  | DatabaseError
  | EmailServiceError
  | ConfigurationError;

// Error code mapping
export const AuthErrorCodes = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  OTP_REQUIRED: 'OTP_REQUIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_EXISTS: 'USER_EXISTS',
  WEBAUTHN_NOT_SUPPORTED: 'WEBAUTHN_NOT_SUPPORTED',
  WEBAUTHN_FAILED: 'WEBAUTHN_FAILED',
  AUTH_METHOD_MISMATCH: 'AUTH_METHOD_MISMATCH',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_INVALID: 'SESSION_INVALID',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
} as const;

// Helper functions to create errors
export const createAuthError = (code: string, message: string, details?: Record<string, unknown>) =>
  new AuthError({ code, message, details });

export const createInvalidCredentialsError = (message = 'Invalid email or password') =>
  new InvalidCredentialsError({ message });

export const createEmailNotVerifiedError = (email: string, message = 'Email address must be verified before login') =>
  new EmailNotVerifiedError({ message, email });

export const createAccountLockedError = (lockedUntil: Date, message = 'Account is temporarily locked due to too many failed login attempts') =>
  new AccountLockedError({ message, lockedUntil });

export const createOtpRequiredError = (message = 'One-time password is required') =>
  new OtpRequiredError({ message });

export const createOtpInvalidError = (attemptsRemaining: number, message = 'Invalid one-time password') =>
  new OtpInvalidError({ message, attemptsRemaining });

export const createOtpExpiredError = (message = 'One-time password has expired') =>
  new OtpExpiredError({ message });

export const createTokenInvalidError = (tokenType: string, message = 'Invalid token') =>
  new TokenInvalidError({ message, tokenType });

export const createTokenExpiredError = (tokenType: string, message = 'Token has expired') =>
  new TokenExpiredError({ message, tokenType });

export const createUserNotFoundError = (email?: string, message = 'User not found') =>
  new UserNotFoundError({ message, email });

export const createUserExistsError = (email: string, message = 'User with this email already exists') =>
  new UserExistsError({ message, email });

export const createWebAuthnNotSupportedError = (message = 'WebAuthn is not supported in this environment') =>
  new WebAuthnNotSupportedError({ message });

export const createWebAuthnFailedError = (reason: string, message = 'WebAuthn authentication failed') =>
  new WebAuthnFailedError({ message, reason });

export const createAuthMethodMismatchError = (expectedMethod: string, actualMethod: string, message = 'Authentication method mismatch') =>
  new AuthMethodMismatchError({ message, expectedMethod, actualMethod });

export const createValidationError = (field: string, errors: string[], message = 'Validation failed') =>
  new ValidationError({ message, field, errors });

export const createRateLimitExceededError = (retryAfter: number, message = 'Rate limit exceeded') =>
  new RateLimitExceededError({ message, retryAfter });

export const createSessionExpiredError = (message = 'Session has expired') =>
  new SessionExpiredError({ message });

export const createSessionInvalidError = (message = 'Invalid session') =>
  new SessionInvalidError({ message });

export const createPermissionDeniedError = (resource: string, message = 'Permission denied') =>
  new PermissionDeniedError({ message, resource });

export const createDatabaseError = (operation: string, message = 'Database operation failed') =>
  new DatabaseError({ message, operation });

export const createEmailServiceError = (emailType: string, message = 'Email service error') =>
  new EmailServiceError({ message, emailType });

export const createConfigurationError = (setting: string, message = 'Configuration error') =>
  new ConfigurationError({ message, setting });

