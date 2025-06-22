/**
 * Password authentication service using Effect-TS
 * Handles password hashing, validation, and credential management
 */

import { Effect, Layer, Context } from 'effect';
import { Schema } from '@effect/schema';
import bcrypt from 'bcrypt';
import {
  createInvalidCredentialsError,
  createEmailNotVerifiedError,
  createAccountLockedError,
  createValidationError,
  createUserNotFoundError,
  type AuthError,
} from '@solid-octo-invention/shared';
import { DatabaseService } from '../database.js';
import { OTPService } from './OTPService.js';
import { EmailService } from './EmailService.js';

export interface PasswordAuthService {
  readonly createCredentials: (userId: string, password: string) => Effect.Effect<void, AuthError>;
  readonly authenticate: (
    user: any,
    password: string,
    otp?: string,
  ) => Effect.Effect<{ success?: boolean; requiresOtp?: boolean }, AuthError>;
  readonly sendEmailVerification: (user: any) => Effect.Effect<{ message: string }, AuthError>;
  readonly verifyEmailToken: (token: string) => Effect.Effect<{ message: string }, AuthError>;
  readonly sendPasswordReset: (email: string) => Effect.Effect<{ message: string }, AuthError>;
  readonly completePasswordReset: (
    token: string,
    newPassword: string,
  ) => Effect.Effect<{ message: string }, AuthError>;
  readonly changePassword: (
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) => Effect.Effect<{ message: string }, AuthError>;
  readonly getCredentialStatus: (userId: string) => Effect.Effect<any, AuthError>;
  readonly unlockAccount: (userId: string) => Effect.Effect<{ message: string }, AuthError>;
}

export const PasswordAuthService = Context.GenericTag<PasswordAuthService>('PasswordAuthService');

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

const make = Effect.gen(function* () {
  const db = yield* DatabaseService;
  const otp = yield* OTPService;
  const email = yield* EmailService;

  const validatePasswordStrength = (password: string) =>
    Effect.gen(function* () {
      const minLength = 8;
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?\":{}|<>]/.test(password);

      const errors: string[] = [];

      if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long`);
      }
      if (!hasUpperCase) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!hasLowerCase) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!hasNumbers) {
        errors.push('Password must contain at least one number');
      }
      if (!hasSpecialChar) {
        errors.push('Password must contain at least one special character');
      }

      if (errors.length > 0) {
        return yield* Effect.fail(
          createValidationError('password', errors, 'Password does not meet requirements'),
        );
      }

      return true;
    });

  const hashPassword = (password: string) =>
    Effect.tryPromise({
      try: () => bcrypt.hash(password, BCRYPT_ROUNDS),
      catch: (error) =>
        new AuthError({
          code: 'INTERNAL_ERROR',
          message: 'Failed to hash password',
          details: { error },
        }),
    });

  const verifyPassword = (password: string, hash: string) =>
    Effect.tryPromise({
      try: () => bcrypt.compare(password, hash),
      catch: (error) =>
        new AuthError({
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify password',
          details: { error },
        }),
    });

  const createCredentials = (userId: string, password: string) =>
    Effect.gen(function* () {
      // Validate password strength
      yield* validatePasswordStrength(password);

      // Hash password
      const passwordHash = yield* hashPassword(password);

      // Create credentials record
      yield* db.query(
        `INSERT INTO password_credentials (user_id, password_hash) 
         VALUES ($1, $2)`,
        [userId, passwordHash],
      );
    });

  const authenticate = (user: any, password: string, otp?: string) =>
    Effect.gen(function* () {
      // Get password credentials
      const credResult = yield* db.query(
        'SELECT * FROM password_credentials WHERE user_id = $1',
        [user.id],
      );

      if (credResult.rows.length === 0) {
        return yield* Effect.fail(createInvalidCredentialsError());
      }

      const credential = credResult.rows[0];

      // Check if account is locked
      if (credential.locked_until && new Date(credential.locked_until) > new Date()) {
        const lockTimeRemaining = Math.ceil(
          (new Date(credential.locked_until).getTime() - new Date().getTime()) / 1000 / 60,
        );
        return yield* Effect.fail(
          createAccountLockedError(
            new Date(credential.locked_until),
            `Account is locked due to too many failed attempts. Try again in ${lockTimeRemaining} minutes.`,
          ),
        );
      }

      // Check if email is verified
      if (!credential.email_verified) {
        return yield* Effect.fail(
          createEmailNotVerifiedError(
            user.email,
            'Email must be verified before logging in. Please check your email for verification link.',
          ),
        );
      }

      // Verify password
      const isPasswordValid = yield* verifyPassword(password, credential.password_hash);
      if (!isPasswordValid) {
        // Increment failed attempts
        const newFailedAttempts = credential.failed_login_attempts + 1;
        const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;
        const lockedUntil = shouldLock
          ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
          : null;

        yield* db.query(
          `UPDATE password_credentials 
           SET failed_login_attempts = $1, locked_until = $2 
           WHERE user_id = $3`,
          [newFailedAttempts, lockedUntil, user.id],
        );

        return yield* Effect.fail(createInvalidCredentialsError());
      }

      // If no OTP provided, send OTP and require it
      if (!otp) {
        yield* otp.generateAndSendOTP(user.id, 'login_otp', 10); // 10 minutes expiry
        return { requiresOtp: true };
      }

      // Verify OTP
      const isOTPValid = yield* otp.verifyOTP(user.id, otp, 'login_otp');
      if (!isOTPValid) {
        return yield* Effect.fail(
          new AuthError({
            code: 'OTP_INVALID',
            message: 'Invalid or expired OTP',
          }),
        );
      }

      // Reset failed attempts on successful login
      yield* db.query(
        `UPDATE password_credentials 
         SET failed_login_attempts = 0, locked_until = NULL 
         WHERE user_id = $1`,
        [user.id],
      );

      return { success: true };
    });

  const sendEmailVerification = (user: any) =>
    Effect.gen(function* () {
      const token = yield* otp.generateOTP(user.id, 'email_verification', 24 * 60); // 24 hours
      yield* email.sendEmailVerification(user.email, token);
      return { message: 'Verification email sent' };
    });

  const verifyEmailToken = (token: string) =>
    Effect.gen(function* () {
      const otpRecord = yield* otp.findValidOTP(token, 'email_verification');
      if (!otpRecord) {
        return yield* Effect.fail(
          new AuthError({
            code: 'TOKEN_INVALID',
            message: 'Invalid or expired verification token',
          }),
        );
      }

      // Mark email as verified
      yield* db.query(
        'UPDATE password_credentials SET email_verified = true WHERE user_id = $1',
        [otpRecord.user_id],
      );

      // Mark token as used
      yield* otp.markOTPAsUsed(otpRecord.id);

      return { message: 'Email verified successfully' };
    });

  const sendPasswordReset = (email: string) =>
    Effect.gen(function* () {
      // Always return success message to prevent email enumeration
      const successMessage =
        'If an account with this email exists, a password reset link has been sent.';

      const userResult = yield* db.query(
        'SELECT * FROM users WHERE email = $1 AND auth_method = $2',
        [email.toLowerCase(), 'password'],
      );

      if (userResult.rows.length === 0) {
        return { message: successMessage };
      }

      const user = userResult.rows[0];
      const token = yield* otp.generateOTP(user.id, 'password_reset', 60); // 1 hour
      yield* email.sendPasswordReset(user.email, token);

      return { message: successMessage };
    });

  const completePasswordReset = (token: string, newPassword: string) =>
    Effect.gen(function* () {
      const otpRecord = yield* otp.findValidOTP(token, 'password_reset');
      if (!otpRecord) {
        return yield* Effect.fail(
          new AuthError({
            code: 'TOKEN_INVALID',
            message: 'Invalid or expired reset token',
          }),
        );
      }

      // Validate new password
      yield* validatePasswordStrength(newPassword);

      // Hash new password
      const newPasswordHash = yield* hashPassword(newPassword);

      // Update password and reset failed attempts
      yield* db.query(
        `UPDATE password_credentials 
         SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL 
         WHERE user_id = $2`,
        [newPasswordHash, otpRecord.user_id],
      );

      // Mark token as used
      yield* otp.markOTPAsUsed(otpRecord.id);

      return { message: 'Password reset successfully' };
    });

  const changePassword = (userId: string, currentPassword: string, newPassword: string) =>
    Effect.gen(function* () {
      const credResult = yield* db.query(
        'SELECT * FROM password_credentials WHERE user_id = $1',
        [userId],
      );

      if (credResult.rows.length === 0) {
        return yield* Effect.fail(createUserNotFoundError());
      }

      const credential = credResult.rows[0];

      // Verify current password
      const isCurrentPasswordValid = yield* verifyPassword(currentPassword, credential.password_hash);
      if (!isCurrentPasswordValid) {
        return yield* Effect.fail(
          new AuthError({
            code: 'INVALID_CREDENTIALS',
            message: 'Current password is incorrect',
          }),
        );
      }

      // Validate new password
      yield* validatePasswordStrength(newPassword);

      // Check if new password is different from current
      const isSamePassword = yield* verifyPassword(newPassword, credential.password_hash);
      if (isSamePassword) {
        return yield* Effect.fail(
          createValidationError(
            'password',
            ['New password must be different from current password'],
            'Password validation failed',
          ),
        );
      }

      // Hash and update password
      const newPasswordHash = yield* hashPassword(newPassword);
      yield* db.query(
        'UPDATE password_credentials SET password_hash = $1 WHERE user_id = $2',
        [newPasswordHash, userId],
      );

      return { message: 'Password changed successfully' };
    });

  const getCredentialStatus = (userId: string) =>
    Effect.gen(function* () {
      const credResult = yield* db.query(
        'SELECT * FROM password_credentials WHERE user_id = $1',
        [userId],
      );

      if (credResult.rows.length === 0) {
        return null;
      }

      const credential = credResult.rows[0];
      const isLocked = credential.locked_until && new Date(credential.locked_until) > new Date();

      return {
        emailVerified: credential.email_verified,
        failedAttempts: credential.failed_login_attempts,
        isLocked,
        lockedUntil: credential.locked_until,
      };
    });

  const unlockAccount = (userId: string) =>
    Effect.gen(function* () {
      yield* db.query(
        `UPDATE password_credentials 
         SET failed_login_attempts = 0, locked_until = NULL 
         WHERE user_id = $1`,
        [userId],
      );

      return { message: 'Account unlocked successfully' };
    });

  return {
    createCredentials,
    authenticate,
    sendEmailVerification,
    verifyEmailToken,
    sendPasswordReset,
    completePasswordReset,
    changePassword,
    getCredentialStatus,
    unlockAccount,
  } as const;
});

export const PasswordAuthServiceLive = Layer.effect(PasswordAuthService, make).pipe(
  Layer.provide(DatabaseService.Default),
  Layer.provide(OTPService.Default),
  Layer.provide(EmailService.Default),
);

