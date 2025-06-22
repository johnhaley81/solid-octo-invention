/**
 * Authentication types for the application
 * Shared between frontend and backend
 */

export type AuthMethod = 'password' | 'webauthn';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  authMethod: AuthMethod;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordCredential {
  id: string;
  userId: string;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebAuthnCredential {
  id: string;
  userId: string;
  credentialId: string;
  deviceType?: string;
  backupEligible: boolean;
  backupState: boolean;
  transports?: string[];
  createdAt: string;
  lastUsed?: string;
}

export interface OtpToken {
  id: string;
  userId: string;
  token: string;
  tokenType: 'email_verification' | 'login_otp' | 'password_reset';
  expiresAt: string;
  usedAt?: string;
  attempts: number;
  createdAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  sessionToken: string;
  authMethod: AuthMethod;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt: string;
}

// Authentication request/response types
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  otp?: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  requiresOtp?: boolean;
  sessionToken?: string;
  message?: string;
}

export interface WebAuthnRegistrationRequest {
  email: string;
  name: string;
}

export interface WebAuthnRegistrationResponse {
  success: boolean;
  user?: User;
  registrationOptions?: PublicKeyCredentialCreationOptions;
  message?: string;
}

export interface WebAuthnAuthenticationRequest {
  email: string;
}

export interface WebAuthnAuthenticationResponse {
  success: boolean;
  user?: User;
  authenticationOptions?: PublicKeyCredentialRequestOptions;
  sessionToken?: string;
  message?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface EmailVerificationRequest {
  token: string;
}

export interface AuthSwitchRequest {
  newAuthMethod: AuthMethod;
  password?: string; // Required when switching to password
}

export interface AuthSwitchResponse {
  success: boolean;
  user: User;
  requiresEmailVerification?: boolean;
  message: string;
}

// WebAuthn specific types
export interface WebAuthnRegistrationCredential {
  id: string;
  rawId: ArrayBuffer;
  response: {
    clientDataJSON: ArrayBuffer;
    attestationObject: ArrayBuffer;
    transports?: AuthenticatorTransport[];
  };
  type: 'public-key';
}

export interface WebAuthnAuthenticationCredential {
  id: string;
  rawId: ArrayBuffer;
  response: {
    clientDataJSON: ArrayBuffer;
    authenticatorData: ArrayBuffer;
    signature: ArrayBuffer;
    userHandle?: ArrayBuffer;
  };
  type: 'public-key';
}

// Error types
export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_LOCKED'
  | 'OTP_REQUIRED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'USER_NOT_FOUND'
  | 'USER_EXISTS'
  | 'WEBAUTHN_NOT_SUPPORTED'
  | 'WEBAUTHN_FAILED'
  | 'AUTH_METHOD_MISMATCH'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

// Validation types
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export interface EmailValidation {
  isValid: boolean;
  error?: string;
}

// Authentication context
export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}

// Session management
export interface SessionInfo {
  user: User;
  sessionToken: string;
  expiresAt: string;
  authMethod: AuthMethod;
}

export interface AuthState {
  user: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}

