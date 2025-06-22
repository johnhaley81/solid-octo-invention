/**
 * Authentication schemas using Effect-TS Schema
 * Provides runtime validation and type safety
 */

import { Schema } from '@effect/schema';

// Basic validation schemas
export const Email = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand('Email'),
);

export const Password = Schema.String.pipe(
  Schema.minLength(8),
  Schema.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/),
  Schema.brand('Password'),
);

export const AuthMethod = Schema.Literal('password', 'webauthn');

export const OtpToken = Schema.String.pipe(
  Schema.pattern(/^\d{6}$/),
  Schema.brand('OtpToken'),
);

export const SessionToken = Schema.String.pipe(
  Schema.minLength(32),
  Schema.brand('SessionToken'),
);

// User schema
export const User = Schema.Struct({
  id: Schema.UUID,
  email: Email,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
  avatarUrl: Schema.optional(Schema.String),
  authMethod: AuthMethod,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
});

// Password credential schema
export const PasswordCredential = Schema.Struct({
  id: Schema.UUID,
  userId: Schema.UUID,
  emailVerified: Schema.Boolean,
  failedLoginAttempts: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  lockedUntil: Schema.optional(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
});

// WebAuthn credential schema
export const WebAuthnCredential = Schema.Struct({
  id: Schema.UUID,
  userId: Schema.UUID,
  credentialId: Schema.String,
  deviceType: Schema.optional(Schema.String),
  backupEligible: Schema.Boolean,
  backupState: Schema.Boolean,
  transports: Schema.optional(Schema.Array(Schema.String)),
  createdAt: Schema.DateTimeUtc,
  lastUsed: Schema.optional(Schema.DateTimeUtc),
});

// OTP token schema
export const OtpTokenRecord = Schema.Struct({
  id: Schema.UUID,
  userId: Schema.UUID,
  token: Schema.String,
  tokenType: Schema.Literal('email_verification', 'login_otp', 'password_reset'),
  expiresAt: Schema.DateTimeUtc,
  usedAt: Schema.optional(Schema.DateTimeUtc),
  attempts: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  createdAt: Schema.DateTimeUtc,
});

// User session schema
export const UserSession = Schema.Struct({
  id: Schema.UUID,
  userId: Schema.UUID,
  sessionToken: SessionToken,
  authMethod: AuthMethod,
  ipAddress: Schema.optional(Schema.String),
  userAgent: Schema.optional(Schema.String),
  expiresAt: Schema.DateTimeUtc,
  createdAt: Schema.DateTimeUtc,
});

// Request schemas
export const RegisterRequest = Schema.Struct({
  email: Email,
  password: Password,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
});

export const LoginRequest = Schema.Struct({
  email: Email,
  password: Schema.String,
  otp: Schema.optional(OtpToken),
});

export const WebAuthnRegistrationRequest = Schema.Struct({
  email: Email,
  name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
});

export const WebAuthnAuthenticationRequest = Schema.Struct({
  email: Email,
});

export const PasswordResetRequest = Schema.Struct({
  email: Email,
});

export const PasswordResetConfirmRequest = Schema.Struct({
  token: Schema.String,
  newPassword: Password,
});

export const EmailVerificationRequest = Schema.Struct({
  token: Schema.String,
});

export const AuthSwitchRequest = Schema.Struct({
  newAuthMethod: AuthMethod,
  password: Schema.optional(Password),
});

// Response schemas
export const LoginResponse = Schema.Struct({
  success: Schema.Boolean,
  user: Schema.optional(User),
  requiresOtp: Schema.optional(Schema.Boolean),
  sessionToken: Schema.optional(SessionToken),
  message: Schema.optional(Schema.String),
});

export const WebAuthnRegistrationResponse = Schema.Struct({
  success: Schema.Boolean,
  user: Schema.optional(User),
  registrationOptions: Schema.optional(Schema.Unknown), // PublicKeyCredentialCreationOptions
  message: Schema.optional(Schema.String),
});

export const WebAuthnAuthenticationResponse = Schema.Struct({
  success: Schema.Boolean,
  user: Schema.optional(User),
  authenticationOptions: Schema.optional(Schema.Unknown), // PublicKeyCredentialRequestOptions
  sessionToken: Schema.optional(SessionToken),
  message: Schema.optional(Schema.String),
});

export const PasswordResetResponse = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.String,
});

export const AuthSwitchResponse = Schema.Struct({
  success: Schema.Boolean,
  user: User,
  requiresEmailVerification: Schema.optional(Schema.Boolean),
  message: Schema.String,
});

// Error schemas
export const AuthError = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  details: Schema.optional(Schema.Unknown),
});

// Validation result schemas
export const PasswordValidation = Schema.Struct({
  isValid: Schema.Boolean,
  errors: Schema.Array(Schema.String),
});

export const EmailValidation = Schema.Struct({
  isValid: Schema.Boolean,
  error: Schema.optional(Schema.String),
});

// Authentication context schema
export const AuthContext = Schema.Struct({
  user: Schema.NullOr(User),
  isAuthenticated: Schema.Boolean,
  isLoading: Schema.Boolean,
  error: Schema.NullOr(AuthError),
});

// Session info schema
export const SessionInfo = Schema.Struct({
  user: User,
  sessionToken: SessionToken,
  expiresAt: Schema.DateTimeUtc,
  authMethod: AuthMethod,
});

// Auth state schema
export const AuthState = Schema.Struct({
  user: Schema.NullOr(User),
  sessionToken: Schema.NullOr(SessionToken),
  isAuthenticated: Schema.Boolean,
  isLoading: Schema.Boolean,
  error: Schema.NullOr(AuthError),
});

// WebAuthn credential schemas for browser API
export const WebAuthnRegistrationCredential = Schema.Struct({
  id: Schema.String,
  rawId: Schema.Unknown, // ArrayBuffer
  response: Schema.Struct({
    clientDataJSON: Schema.Unknown, // ArrayBuffer
    attestationObject: Schema.Unknown, // ArrayBuffer
    transports: Schema.optional(Schema.Array(Schema.String)),
  }),
  type: Schema.Literal('public-key'),
});

export const WebAuthnAuthenticationCredential = Schema.Struct({
  id: Schema.String,
  rawId: Schema.Unknown, // ArrayBuffer
  response: Schema.Struct({
    clientDataJSON: Schema.Unknown, // ArrayBuffer
    authenticatorData: Schema.Unknown, // ArrayBuffer
    signature: Schema.Unknown, // ArrayBuffer
    userHandle: Schema.optional(Schema.Unknown), // ArrayBuffer
  }),
  type: Schema.Literal('public-key'),
});

// Derived types
export type EmailBrand = Schema.Schema.Type<typeof Email>;
export type PasswordBrand = Schema.Schema.Type<typeof Password>;
export type OtpTokenBrand = Schema.Schema.Type<typeof OtpToken>;
export type SessionTokenBrand = Schema.Schema.Type<typeof SessionToken>;

export type UserType = Schema.Schema.Type<typeof User>;
export type PasswordCredentialType = Schema.Schema.Type<typeof PasswordCredential>;
export type WebAuthnCredentialType = Schema.Schema.Type<typeof WebAuthnCredential>;
export type OtpTokenRecordType = Schema.Schema.Type<typeof OtpTokenRecord>;
export type UserSessionType = Schema.Schema.Type<typeof UserSession>;

export type RegisterRequestType = Schema.Schema.Type<typeof RegisterRequest>;
export type LoginRequestType = Schema.Schema.Type<typeof LoginRequest>;
export type WebAuthnRegistrationRequestType = Schema.Schema.Type<typeof WebAuthnRegistrationRequest>;
export type WebAuthnAuthenticationRequestType = Schema.Schema.Type<typeof WebAuthnAuthenticationRequest>;
export type PasswordResetRequestType = Schema.Schema.Type<typeof PasswordResetRequest>;
export type PasswordResetConfirmRequestType = Schema.Schema.Type<typeof PasswordResetConfirmRequest>;
export type EmailVerificationRequestType = Schema.Schema.Type<typeof EmailVerificationRequest>;
export type AuthSwitchRequestType = Schema.Schema.Type<typeof AuthSwitchRequest>;

export type LoginResponseType = Schema.Schema.Type<typeof LoginResponse>;
export type WebAuthnRegistrationResponseType = Schema.Schema.Type<typeof WebAuthnRegistrationResponse>;
export type WebAuthnAuthenticationResponseType = Schema.Schema.Type<typeof WebAuthnAuthenticationResponse>;
export type PasswordResetResponseType = Schema.Schema.Type<typeof PasswordResetResponse>;
export type AuthSwitchResponseType = Schema.Schema.Type<typeof AuthSwitchResponse>;

export type AuthErrorType = Schema.Schema.Type<typeof AuthError>;
export type PasswordValidationType = Schema.Schema.Type<typeof PasswordValidation>;
export type EmailValidationType = Schema.Schema.Type<typeof EmailValidation>;
export type AuthContextType = Schema.Schema.Type<typeof AuthContext>;
export type SessionInfoType = Schema.Schema.Type<typeof SessionInfo>;
export type AuthStateType = Schema.Schema.Type<typeof AuthState>;

export type WebAuthnRegistrationCredentialType = Schema.Schema.Type<typeof WebAuthnRegistrationCredential>;
export type WebAuthnAuthenticationCredentialType = Schema.Schema.Type<typeof WebAuthnAuthenticationCredential>;
