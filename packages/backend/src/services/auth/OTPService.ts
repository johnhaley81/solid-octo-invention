/**
 * OTP (One-Time Password) service using Effect-TS
 * Handles generation, verification, and management of OTP tokens
 */

import { Effect, Layer, Context } from 'effect';
import { randomBytes } from 'crypto';
import {
  createOtpInvalidError,
  createOtpExpiredError,
  type AuthError,
} from '@solid-octo-invention/shared';
import { DatabaseService } from '../database.js';
import { EmailService } from './EmailService.js';

export interface OTPService {
  readonly generateOTP: (
    userId: string,
    tokenType: 'email_verification' | 'login_otp' | 'password_reset',
    expiryMinutes: number,
  ) => Effect.Effect<string, AuthError>;

  readonly generateAndSendOTP: (
    userId: string,
    tokenType: 'email_verification' | 'login_otp' | 'password_reset',
    expiryMinutes: number,
  ) => Effect.Effect<void, AuthError>;

  readonly verifyOTP: (
    userId: string,
    token: string,
    tokenType: 'email_verification' | 'login_otp' | 'password_reset',
  ) => Effect.Effect<boolean, AuthError>;

  readonly findValidOTP: (
    token: string,
    tokenType: 'email_verification' | 'login_otp' | 'password_reset',
  ) => Effect.Effect<any | null, AuthError>;

  readonly markOTPAsUsed: (otpId: string) => Effect.Effect<void, AuthError>;

  readonly cleanupExpiredOTPs: () => Effect.Effect<void, AuthError>;
}

export const OTPService = Context.GenericTag<OTPService>('OTPService');

const MAX_OTP_ATTEMPTS = 3;

const make = Effect.gen(function* () {
  const db = yield* DatabaseService;
  const email = yield* EmailService;

  const generateRandomOTP = (length: number = 6) =>
    Effect.sync(() => {
      const digits = '0123456789';
      let otp = '';
      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * digits.length);
        otp += digits[randomIndex];
      }
      return otp;
    });

  const generateSecureToken = () =>
    Effect.sync(() => {
      return randomBytes(32).toString('hex');
    });

  const generateOTP = (
    userId: string,
    tokenType: 'email_verification' | 'login_otp' | 'password_reset',
    expiryMinutes: number,
  ) =>
    Effect.gen(function* () {
      // Generate token based on type
      const token =
        tokenType === 'login_otp'
          ? yield* generateRandomOTP(6)
          : yield* generateSecureToken();

      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

      // Clean up any existing tokens of the same type for this user
      yield* db.query(
        'DELETE FROM otp_tokens WHERE user_id = $1 AND token_type = $2',
        [userId, tokenType],
      );

      // Insert new token
      yield* db.query(
        `INSERT INTO otp_tokens (user_id, token, token_type, expires_at) 
         VALUES ($1, $2, $3, $4)`,
        [userId, token, tokenType, expiresAt],
      );

      return token;
    });

  const generateAndSendOTP = (
    userId: string,
    tokenType: 'email_verification' | 'login_otp' | 'password_reset',
    expiryMinutes: number,
  ) =>
    Effect.gen(function* () {
      // Get user email
      const userResult = yield* db.query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return yield* Effect.fail(
          new AuthError({
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          }),
        );
      }

      const userEmail = userResult.rows[0].email;
      const token = yield* generateOTP(userId, tokenType, expiryMinutes);

      // Send appropriate email based on token type
      switch (tokenType) {
        case 'login_otp':
          yield* email.sendLoginOTP(userEmail, token);
          break;
        case 'email_verification':
          yield* email.sendEmailVerification(userEmail, token);
          break;
        case 'password_reset':
          yield* email.sendPasswordReset(userEmail, token);
          break;
      }
    });

  const verifyOTP = (
    userId: string,
    token: string,
    tokenType: 'email_verification' | 'login_otp' | 'password_reset',
  ) =>
    Effect.gen(function* () {
      const otpResult = yield* db.query(
        `SELECT * FROM otp_tokens 
         WHERE user_id = $1 AND token = $2 AND token_type = $3 AND used_at IS NULL`,
        [userId, token, tokenType],
      );

      if (otpResult.rows.length === 0) {
        return yield* Effect.fail(createOtpInvalidError('Invalid OTP', 0));
      }

      const otpRecord = otpResult.rows[0];

      // Check if expired
      if (new Date(otpRecord.expires_at) < new Date()) {
        return yield* Effect.fail(createOtpExpiredError('OTP has expired'));
      }

      // Check attempts
      if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
        return yield* Effect.fail(
          createOtpInvalidError('Too many failed attempts', 0),
        );
      }

      // For login OTP, mark as used immediately upon successful verification
      if (tokenType === 'login_otp') {
        yield* db.query(
          'UPDATE otp_tokens SET used_at = NOW() WHERE id = $1',
          [otpRecord.id],
        );
      }

      return true;
    });

  const findValidOTP = (
    token: string,
    tokenType: 'email_verification' | 'login_otp' | 'password_reset',
  ) =>
    Effect.gen(function* () {
      const otpResult = yield* db.query(
        `SELECT * FROM otp_tokens 
         WHERE token = $1 AND token_type = $2 AND used_at IS NULL AND expires_at > NOW()`,
        [token, tokenType],
      );

      if (otpResult.rows.length === 0) {
        return null;
      }

      return otpResult.rows[0];
    });

  const markOTPAsUsed = (otpId: string) =>
    Effect.gen(function* () {
      yield* db.query(
        'UPDATE otp_tokens SET used_at = NOW() WHERE id = $1',
        [otpId],
      );
    });

  const incrementOTPAttempts = (otpId: string) =>
    Effect.gen(function* () {
      yield* db.query(
        'UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = $1',
        [otpId],
      );
    });

  const cleanupExpiredOTPs = () =>
    Effect.gen(function* () {
      yield* db.query('DELETE FROM otp_tokens WHERE expires_at < NOW()');
    });

  return {
    generateOTP,
    generateAndSendOTP,
    verifyOTP,
    findValidOTP,
    markOTPAsUsed,
    cleanupExpiredOTPs,
  } as const;
});

export const OTPServiceLive = Layer.effect(OTPService, make).pipe(
  Layer.provide(DatabaseService.Default),
  Layer.provide(EmailService.Default),
);

