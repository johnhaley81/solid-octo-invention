/**
 * Main authentication service using Effect-TS
 * Coordinates between password and WebAuthn authentication methods
 */

import { Effect, Layer, Context } from 'effect';
import { Schema } from '@effect/schema';
import {
  AuthError,
  createUserNotFoundError,
  createAuthMethodMismatchError,
  createUserExistsError,
  type AuthMethod,
  type RegisterRequestType,
  type LoginRequestType,
  type WebAuthnRegistrationRequestType,
  type WebAuthnAuthenticationRequestType,
  type AuthSwitchRequestType,
} from '@solid-octo-invention/shared';
import { DatabaseService } from '../database.js';
import { PasswordAuthService } from './PasswordAuthService.js';
import { WebAuthnService } from './WebAuthnService.js';
import { EmailService } from './EmailService.js';
import { SessionService } from './SessionService.js';

export interface AuthService {
  readonly registerWithPassword: (
    request: RegisterRequestType,
  ) => Effect.Effect<{ user: any; requiresEmailVerification: boolean }, AuthError>;

  readonly loginWithPassword: (
    request: LoginRequestType,
  ) => Effect.Effect<
    { user?: any; requiresOtp?: boolean; sessionToken?: string; message?: string },
    AuthError
  >;

  readonly beginWebAuthnRegistration: (
    request: WebAuthnRegistrationRequestType,
  ) => Effect.Effect<{ user: any; registrationOptions: any }, AuthError>;

  readonly completeWebAuthnRegistration: (
    userId: string,
    registrationResponse: any,
  ) => Effect.Effect<{ user: any; credential: any }, AuthError>;

  readonly beginWebAuthnAuthentication: (
    request: WebAuthnAuthenticationRequestType,
  ) => Effect.Effect<{ user: any; authenticationOptions: any }, AuthError>;

  readonly completeWebAuthnAuthentication: (
    userId: string,
    authenticationResponse: any,
  ) => Effect.Effect<{ user: any; sessionToken: string }, AuthError>;

  readonly switchAuthMethod: (
    userId: string,
    request: AuthSwitchRequestType,
  ) => Effect.Effect<{ user: any; requiresEmailVerification?: boolean; message: string }, AuthError>;

  readonly verifyEmail: (token: string) => Effect.Effect<{ message: string }, AuthError>;

  readonly resendEmailVerification: (email: string) => Effect.Effect<{ message: string }, AuthError>;

  readonly getUserAuthStatus: (userId: string) => Effect.Effect<any, AuthError>;

  readonly logout: (userId: string, sessionId: string) => Effect.Effect<{ message: string }, AuthError>;

  readonly getUserBySession: (sessionId: string) => Effect.Effect<any | null, AuthError>;
}

export const AuthService = Context.GenericTag<AuthService>('AuthService');

const make = Effect.gen(function* () {
  const db = yield* DatabaseService;
  const passwordAuth = yield* PasswordAuthService;
  const webAuthn = yield* WebAuthnService;
  const email = yield* EmailService;
  const session = yield* SessionService;

  const registerWithPassword = (request: RegisterRequestType) =>
    Effect.gen(function* () {
      // Validate request
      const validatedRequest = yield* Schema.decodeUnknown(
        Schema.Struct({
          email: Schema.String,
          password: Schema.String,
          name: Schema.String,
        }),
      )(request);

      // Check if user already exists
      const existingUser = yield* db.query(
        'SELECT id FROM users WHERE email = $1',
        [validatedRequest.email.toLowerCase()],
      );

      if (existingUser.rows.length > 0) {
        return yield* Effect.fail(createUserExistsError(validatedRequest.email));
      }

      // Create user with password auth method
      const userResult = yield* db.query(
        `INSERT INTO users (email, name, auth_method) 
         VALUES ($1, $2, 'password') 
         RETURNING *`,
        [validatedRequest.email.toLowerCase(), validatedRequest.name],
      );

      const user = userResult.rows[0];

      // Create password credentials
      yield* passwordAuth.createCredentials(user.id, validatedRequest.password);

      // Send email verification
      yield* passwordAuth.sendEmailVerification(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          authMethod: user.auth_method,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        requiresEmailVerification: true,
      };
    });

  const loginWithPassword = (request: LoginRequestType) =>
    Effect.gen(function* () {
      // Validate request
      const validatedRequest = yield* Schema.decodeUnknown(
        Schema.Struct({
          email: Schema.String,
          password: Schema.String,
          otp: Schema.optional(Schema.String),
        }),
      )(request);

      // Find user
      const userResult = yield* db.query(
        'SELECT * FROM users WHERE email = $1 AND auth_method = $2',
        [validatedRequest.email.toLowerCase(), 'password'],
      );

      if (userResult.rows.length === 0) {
        return yield* Effect.fail(createUserNotFoundError());
      }

      const user = userResult.rows[0];

      // Authenticate with password service
      const authResult = yield* passwordAuth.authenticate(
        user,
        validatedRequest.password,
        validatedRequest.otp,
      );

      if (authResult.requiresOtp) {
        return { requiresOtp: true, message: 'OTP sent to your email' };
      }

      // Create session
      const sessionToken = yield* session.createSession(user.id, 'password');

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          authMethod: user.auth_method,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        sessionToken,
      };
    });

  const beginWebAuthnRegistration = (request: WebAuthnRegistrationRequestType) =>
    Effect.gen(function* () {
      // Validate request
      const validatedRequest = yield* Schema.decodeUnknown(
        Schema.Struct({
          email: Schema.String,
          name: Schema.String,
        }),
      )(request);

      // Check if user already exists with password auth
      const existingUser = yield* db.query(
        'SELECT * FROM users WHERE email = $1',
        [validatedRequest.email.toLowerCase()],
      );

      if (existingUser.rows.length > 0 && existingUser.rows[0].auth_method === 'password') {
        return yield* Effect.fail(
          createAuthMethodMismatchError(
            'webauthn',
            'password',
            'This email is already registered with password authentication',
          ),
        );
      }

      let user;
      if (existingUser.rows.length === 0) {
        // Create new user with WebAuthn auth method
        const userResult = yield* db.query(
          `INSERT INTO users (email, name, auth_method) 
           VALUES ($1, $2, 'webauthn') 
           RETURNING *`,
          [validatedRequest.email.toLowerCase(), validatedRequest.name],
        );
        user = userResult.rows[0];
      } else {
        user = existingUser.rows[0];
      }

      // Generate registration options
      const registrationOptions = yield* webAuthn.generateRegistrationOptions(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          authMethod: user.auth_method,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        registrationOptions,
      };
    });

  const completeWebAuthnRegistration = (userId: string, registrationResponse: any) =>
    Effect.gen(function* () {
      // Find user
      const userResult = yield* db.query(
        'SELECT * FROM users WHERE id = $1 AND auth_method = $2',
        [userId, 'webauthn'],
      );

      if (userResult.rows.length === 0) {
        return yield* Effect.fail(createUserNotFoundError());
      }

      const user = userResult.rows[0];

      // Verify and store credential
      const credential = yield* webAuthn.verifyRegistration(user, registrationResponse);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          authMethod: user.auth_method,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        credential: {
          id: credential.id,
          deviceType: credential.device_type,
          createdAt: credential.created_at,
        },
      };
    });

  const beginWebAuthnAuthentication = (request: WebAuthnAuthenticationRequestType) =>
    Effect.gen(function* () {
      // Validate request
      const validatedRequest = yield* Schema.decodeUnknown(
        Schema.Struct({
          email: Schema.String,
        }),
      )(request);

      // Find user
      const userResult = yield* db.query(
        'SELECT * FROM users WHERE email = $1 AND auth_method = $2',
        [validatedRequest.email.toLowerCase(), 'webauthn'],
      );

      if (userResult.rows.length === 0) {
        return yield* Effect.fail(createUserNotFoundError());
      }

      const user = userResult.rows[0];

      // Generate authentication options
      const authenticationOptions = yield* webAuthn.generateAuthenticationOptions(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          authMethod: user.auth_method,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        authenticationOptions,
      };
    });

  const completeWebAuthnAuthentication = (userId: string, authenticationResponse: any) =>
    Effect.gen(function* () {
      // Find user
      const userResult = yield* db.query(
        'SELECT * FROM users WHERE id = $1 AND auth_method = $2',
        [userId, 'webauthn'],
      );

      if (userResult.rows.length === 0) {
        return yield* Effect.fail(createUserNotFoundError());
      }

      const user = userResult.rows[0];

      // Verify authentication
      yield* webAuthn.verifyAuthentication(user, authenticationResponse);

      // Create session
      const sessionToken = yield* session.createSession(user.id, 'webauthn');

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          authMethod: user.auth_method,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        sessionToken,
      };
    });

  const switchAuthMethod = (userId: string, request: AuthSwitchRequestType) =>
    Effect.gen(function* () {
      // Find user
      const userResult = yield* db.query('SELECT * FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0) {
        return yield* Effect.fail(createUserNotFoundError());
      }

      const user = userResult.rows[0];

      if (request.newAuthMethod === user.auth_method) {
        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            authMethod: user.auth_method,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
          message: `Already using ${request.newAuthMethod} authentication`,
        };
      }

      // Update auth method (triggers will clean up old credentials)
      yield* db.query('UPDATE users SET auth_method = $1 WHERE id = $2', [
        request.newAuthMethod,
        userId,
      ]);

      let requiresEmailVerification = false;

      if (request.newAuthMethod === 'password') {
        if (!request.password) {
          return yield* Effect.fail(
            new AuthError({
              code: 'VALIDATION_ERROR',
              message: 'Password is required when switching to password authentication',
            }),
          );
        }

        // Create password credentials
        yield* passwordAuth.createCredentials(userId, request.password);

        // Send email verification
        const updatedUser = { ...user, auth_method: 'password' };
        yield* passwordAuth.sendEmailVerification(updatedUser);
        requiresEmailVerification = true;
      }

      // Send notification email
      yield* email.sendAuthMethodChangeNotification(user.email, request.newAuthMethod);

      const updatedUserResult = yield* db.query('SELECT * FROM users WHERE id = $1', [userId]);
      const updatedUser = updatedUserResult.rows[0];

      return {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          authMethod: updatedUser.auth_method,
          createdAt: updatedUser.created_at,
          updatedAt: updatedUser.updated_at,
        },
        requiresEmailVerification,
        message: `Successfully switched to ${request.newAuthMethod} authentication`,
      };
    });

  const verifyEmail = (token: string) => passwordAuth.verifyEmailToken(token);

  const resendEmailVerification = (email: string) =>
    Effect.gen(function* () {
      const userResult = yield* db.query(
        'SELECT * FROM users WHERE email = $1 AND auth_method = $2',
        [email.toLowerCase(), 'password'],
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if user exists
        return { message: 'If an account with this email exists, a verification email has been sent.' };
      }

      const user = userResult.rows[0];
      yield* passwordAuth.sendEmailVerification(user);

      return { message: 'Verification email sent successfully.' };
    });

  const getUserAuthStatus = (userId: string) =>
    Effect.gen(function* () {
      const userResult = yield* db.query('SELECT * FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0) {
        return yield* Effect.fail(createUserNotFoundError());
      }

      const user = userResult.rows[0];

      if (user.auth_method === 'password') {
        const passwordStatus = yield* passwordAuth.getCredentialStatus(userId);
        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            authMethod: user.auth_method,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
          passwordAuth: passwordStatus,
        };
      } else {
        const webauthnCredentials = yield* webAuthn.getUserCredentials(userId);
        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            authMethod: user.auth_method,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
          webauthnAuth: {
            credentialCount: webauthnCredentials.length,
            credentials: webauthnCredentials.map((cred: any) => ({
              id: cred.id,
              deviceType: cred.device_type,
              createdAt: cred.created_at,
              lastUsed: cred.last_used,
            })),
          },
        };
      }
    });

  const logout = (userId: string, sessionId: string) => session.deleteSession(sessionId);

  const getUserBySession = (sessionId: string) => session.getUserBySession(sessionId);

  return {
    registerWithPassword,
    loginWithPassword,
    beginWebAuthnRegistration,
    completeWebAuthnRegistration,
    beginWebAuthnAuthentication,
    completeWebAuthnAuthentication,
    switchAuthMethod,
    verifyEmail,
    resendEmailVerification,
    getUserAuthStatus,
    logout,
    getUserBySession,
  } as const;
});

export const AuthServiceLive = Layer.effect(AuthService, make).pipe(
  Layer.provide(DatabaseService.Default),
  Layer.provide(PasswordAuthService.Default),
  Layer.provide(WebAuthnService.Default),
  Layer.provide(EmailService.Default),
  Layer.provide(SessionService.Default),
);

