/**
 * WebAuthn service using Effect-TS
 * Handles WebAuthn passkey registration and authentication
 */

import { Effect, Layer, Context } from 'effect';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import {
  createWebAuthnFailedError,
  createWebAuthnNotSupportedError,
  createUserNotFoundError,
  type AuthError,
} from '@solid-octo-invention/shared';
import { DatabaseService } from '../database.js';

export interface WebAuthnService {
  readonly generateRegistrationOptions: (user: any) => Effect.Effect<any, AuthError>;
  readonly verifyRegistration: (user: any, registrationResponse: any) => Effect.Effect<any, AuthError>;
  readonly generateAuthenticationOptions: (user: any) => Effect.Effect<any, AuthError>;
  readonly verifyAuthentication: (user: any, authenticationResponse: any) => Effect.Effect<void, AuthError>;
  readonly getUserCredentials: (userId: string) => Effect.Effect<any[], AuthError>;
  readonly deleteCredential: (userId: string, credentialId: string) => Effect.Effect<{ message: string }, AuthError>;
}

export const WebAuthnService = Context.GenericTag<WebAuthnService>('WebAuthnService');

const make = Effect.gen(function* () {
  const db = yield* DatabaseService;

  // WebAuthn configuration
  const rpName = process.env.WEBAUTHN_RP_NAME || 'Solid Octo Invention';
  const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
  const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

  const generateRegistrationOptions = (user: any) =>
    Effect.gen(function* () {
      // Get existing credentials for this user
      const existingCredentials = yield* db.query(
        'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1',
        [user.id],
      );

      const excludeCredentials = existingCredentials.rows.map((cred) => ({
        id: cred.credential_id,
        type: 'public-key' as const,
        transports: cred.transports || [],
      }));

      const options: GenerateRegistrationOptionsOpts = {
        rpName,
        rpID,
        userID: user.id,
        userName: user.email,
        userDisplayName: user.name,
        attestationType: 'none',
        excludeCredentials,
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform',
        },
        supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
      };

      const registrationOptions = yield* Effect.try({
        try: () => generateRegistrationOptions(options),
        catch: (error) =>
          createWebAuthnFailedError(
            String(error),
            'Failed to generate WebAuthn registration options',
          ),
      });

      // Store challenge for verification
      yield* db.query(
        `INSERT INTO otp_tokens (user_id, token, token_type, expires_at)
         VALUES ($1, $2, 'webauthn_challenge', NOW() + INTERVAL '5 minutes')
         ON CONFLICT (user_id, token_type) 
         DO UPDATE SET token = $2, expires_at = NOW() + INTERVAL '5 minutes'`,
        [user.id, registrationOptions.challenge],
      );

      return registrationOptions;
    });

  const verifyRegistration = (user: any, registrationResponse: any) =>
    Effect.gen(function* () {
      // Get stored challenge
      const challengeResult = yield* db.query(
        `SELECT token FROM otp_tokens 
         WHERE user_id = $1 AND token_type = 'webauthn_challenge' 
         AND expires_at > NOW() AND used_at IS NULL`,
        [user.id],
      );

      if (challengeResult.rows.length === 0) {
        return yield* Effect.fail(
          createWebAuthnFailedError('challenge_not_found', 'WebAuthn challenge not found or expired'),
        );
      }

      const expectedChallenge = challengeResult.rows[0].token;

      const verification: VerifyRegistrationResponseOpts = {
        response: registrationResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      };

      const verificationResult = yield* Effect.try({
        try: () => verifyRegistrationResponse(verification),
        catch: (error) =>
          createWebAuthnFailedError(
            String(error),
            'Failed to verify WebAuthn registration',
          ),
      });

      if (!verificationResult.verified || !verificationResult.registrationInfo) {
        return yield* Effect.fail(
          createWebAuthnFailedError('verification_failed', 'WebAuthn registration verification failed'),
        );
      }

      const { credentialID, credentialPublicKey, counter, credentialBackedUp, credentialDeviceType } =
        verificationResult.registrationInfo;

      // Store credential
      const credentialResult = yield* db.query(
        `INSERT INTO webauthn_credentials 
         (user_id, credential_id, public_key, counter, device_type, backup_eligible, backup_state, transports)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          user.id,
          Buffer.from(credentialID).toString('base64url'),
          Buffer.from(credentialPublicKey).toString('base64url'),
          counter,
          credentialDeviceType,
          credentialBackedUp,
          credentialBackedUp,
          registrationResponse.response.transports || [],
        ],
      );

      // Mark challenge as used
      yield* db.query(
        'UPDATE otp_tokens SET used_at = NOW() WHERE user_id = $1 AND token_type = $2',
        [user.id, 'webauthn_challenge'],
      );

      return credentialResult.rows[0];
    });

  const generateAuthenticationOptions = (user: any) =>
    Effect.gen(function* () {
      // Get user's credentials
      const credentialsResult = yield* db.query(
        'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1',
        [user.id],
      );

      if (credentialsResult.rows.length === 0) {
        return yield* Effect.fail(
          createWebAuthnFailedError('no_credentials', 'No WebAuthn credentials found for user'),
        );
      }

      const allowCredentials = credentialsResult.rows.map((cred) => ({
        id: Buffer.from(cred.credential_id, 'base64url'),
        type: 'public-key' as const,
        transports: cred.transports || [],
      }));

      const options: GenerateAuthenticationOptionsOpts = {
        rpID,
        allowCredentials,
        userVerification: 'preferred',
        timeout: 60000, // 60 seconds
      };

      const authenticationOptions = yield* Effect.try({
        try: () => generateAuthenticationOptions(options),
        catch: (error) =>
          createWebAuthnFailedError(
            String(error),
            'Failed to generate WebAuthn authentication options',
          ),
      });

      // Store challenge for verification
      yield* db.query(
        `INSERT INTO otp_tokens (user_id, token, token_type, expires_at)
         VALUES ($1, $2, 'webauthn_challenge', NOW() + INTERVAL '5 minutes')
         ON CONFLICT (user_id, token_type) 
         DO UPDATE SET token = $2, expires_at = NOW() + INTERVAL '5 minutes'`,
        [user.id, authenticationOptions.challenge],
      );

      return authenticationOptions;
    });

  const verifyAuthentication = (user: any, authenticationResponse: any) =>
    Effect.gen(function* () {
      // Get stored challenge
      const challengeResult = yield* db.query(
        `SELECT token FROM otp_tokens 
         WHERE user_id = $1 AND token_type = 'webauthn_challenge' 
         AND expires_at > NOW() AND used_at IS NULL`,
        [user.id],
      );

      if (challengeResult.rows.length === 0) {
        return yield* Effect.fail(
          createWebAuthnFailedError('challenge_not_found', 'WebAuthn challenge not found or expired'),
        );
      }

      const expectedChallenge = challengeResult.rows[0].token;

      // Get credential
      const credentialId = Buffer.from(authenticationResponse.id, 'base64url').toString('base64url');
      const credentialResult = yield* db.query(
        'SELECT * FROM webauthn_credentials WHERE user_id = $1 AND credential_id = $2',
        [user.id, credentialId],
      );

      if (credentialResult.rows.length === 0) {
        return yield* Effect.fail(
          createWebAuthnFailedError('credential_not_found', 'WebAuthn credential not found'),
        );
      }

      const credential = credentialResult.rows[0];

      const verification: VerifyAuthenticationResponseOpts = {
        response: authenticationResponse,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: Buffer.from(credential.credential_id, 'base64url'),
          credentialPublicKey: Buffer.from(credential.public_key, 'base64url'),
          counter: credential.counter,
          transports: credential.transports,
        },
        requireUserVerification: true,
      };

      const verificationResult = yield* Effect.try({
        try: () => verifyAuthenticationResponse(verification),
        catch: (error) =>
          createWebAuthnFailedError(
            String(error),
            'Failed to verify WebAuthn authentication',
          ),
      });

      if (!verificationResult.verified) {
        return yield* Effect.fail(
          createWebAuthnFailedError('verification_failed', 'WebAuthn authentication verification failed'),
        );
      }

      // Update credential counter and last used
      yield* db.query(
        'UPDATE webauthn_credentials SET counter = $1, last_used = NOW() WHERE id = $2',
        [verificationResult.authenticationInfo.newCounter, credential.id],
      );

      // Mark challenge as used
      yield* db.query(
        'UPDATE otp_tokens SET used_at = NOW() WHERE user_id = $1 AND token_type = $2',
        [user.id, 'webauthn_challenge'],
      );
    });

  const getUserCredentials = (userId: string) =>
    Effect.gen(function* () {
      const credentialsResult = yield* db.query(
        `SELECT id, credential_id, device_type, backup_eligible, backup_state, 
                transports, created_at, last_used
         FROM webauthn_credentials 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId],
      );

      return credentialsResult.rows.map((cred) => ({
        id: cred.id,
        credentialId: cred.credential_id,
        deviceType: cred.device_type,
        backupEligible: cred.backup_eligible,
        backupState: cred.backup_state,
        transports: cred.transports,
        createdAt: cred.created_at,
        lastUsed: cred.last_used,
      }));
    });

  const deleteCredential = (userId: string, credentialId: string) =>
    Effect.gen(function* () {
      const result = yield* db.query(
        'DELETE FROM webauthn_credentials WHERE user_id = $1 AND credential_id = $2',
        [userId, credentialId],
      );

      if (result.rowCount === 0) {
        return yield* Effect.fail(
          createWebAuthnFailedError('credential_not_found', 'WebAuthn credential not found'),
        );
      }

      return { message: 'WebAuthn credential deleted successfully' };
    });

  const isWebAuthnSupported = () =>
    Effect.sync(() => {
      // Basic check for WebAuthn support
      // In a real implementation, this would check browser capabilities
      return typeof globalThis !== 'undefined' && 'navigator' in globalThis;
    });

  return {
    generateRegistrationOptions,
    verifyRegistration,
    generateAuthenticationOptions,
    verifyAuthentication,
    getUserCredentials,
    deleteCredential,
    isWebAuthnSupported,
  } as const;
});

export const WebAuthnServiceLive = Layer.effect(WebAuthnService, make).pipe(
  Layer.provide(DatabaseService.Default),
);

