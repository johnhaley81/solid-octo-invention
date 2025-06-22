/**
 * Authentication routes for Express server
 * Handles all authentication-related HTTP endpoints
 */

import { Router } from 'express';
import { Effect } from 'effect';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/auth/AuthService.js';
import { SessionService } from '../services/auth/SessionService.js';

const router = Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 3 OTP requests per windowMs
  message: {
    error: 'Too many OTP requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// Helper function to run Effect programs
const runEffect = async <T>(effect: Effect.Effect<T, any>, res: any) => {
  try {
    const result = await Effect.runPromise(effect);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Auth route error:', error);
    
    // Handle tagged errors
    if (error._tag) {
      const statusCode = getStatusCodeForError(error._tag);
      return res.status(statusCode).json({
        success: false,
        error: error.message || 'Authentication error',
        code: error._tag,
        details: error.details,
      });
    }
    
    // Handle unknown errors
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const getStatusCodeForError = (errorTag: string): number => {
  switch (errorTag) {
    case 'UserNotFoundError':
    case 'InvalidCredentialsError':
      return 401;
    case 'EmailNotVerifiedError':
    case 'AccountLockedError':
    case 'OtpRequiredError':
      return 403;
    case 'UserExistsError':
      return 409;
    case 'ValidationError':
    case 'OtpInvalidError':
    case 'TokenInvalidError':
      return 400;
    case 'OtpExpiredError':
    case 'TokenExpiredError':
    case 'SessionExpiredError':
      return 401;
    case 'RateLimitExceededError':
      return 429;
    case 'WebAuthnNotSupportedError':
    case 'WebAuthnFailedError':
      return 400;
    default:
      return 500;
  }
};

// Register with email/password
router.post('/register', authLimiter, async (req, res) => {
  const authService = await Effect.runPromise(AuthService);
  await runEffect(authService.registerWithPassword(req.body), res);
});

// Login with email/password + OTP
router.post('/login', authLimiter, async (req, res) => {
  const authService = await Effect.runPromise(AuthService);
  const result = await runEffect(authService.loginWithPassword(req.body), res);
  
  // Set session cookie if login successful
  if (result && req.body.sessionToken) {
    res.cookie('session_token', req.body.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }
});

// Begin WebAuthn registration
router.post('/webauthn/register/begin', authLimiter, async (req, res) => {
  const authService = await Effect.runPromise(AuthService);
  await runEffect(authService.beginWebAuthnRegistration(req.body), res);
});

// Complete WebAuthn registration
router.post('/webauthn/register/complete', authLimiter, async (req, res) => {
  const { userId, registrationResponse } = req.body;
  const authService = await Effect.runPromise(AuthService);
  await runEffect(authService.completeWebAuthnRegistration(userId, registrationResponse), res);
});

// Begin WebAuthn authentication
router.post('/webauthn/authenticate/begin', authLimiter, async (req, res) => {
  const authService = await Effect.runPromise(AuthService);
  await runEffect(authService.beginWebAuthnAuthentication(req.body), res);
});

// Complete WebAuthn authentication
router.post('/webauthn/authenticate/complete', authLimiter, async (req, res) => {
  const { userId, authenticationResponse } = req.body;
  const authService = await Effect.runPromise(AuthService);
  const result = await runEffect(authService.completeWebAuthnAuthentication(userId, authenticationResponse), res);
  
  // Set session cookie if authentication successful
  if (result && result.data?.sessionToken) {
    res.cookie('session_token', result.data.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  const authService = await Effect.runPromise(AuthService);
  await runEffect(authService.verifyEmail(token), res);
});

// Resend email verification
router.post('/resend-verification', otpLimiter, async (req, res) => {
  const { email } = req.body;
  const authService = await Effect.runPromise(AuthService);
  await runEffect(authService.resendEmailVerification(email), res);
});

// Switch authentication method
router.post('/switch-method', async (req, res) => {
  const userId = req.user?.id; // Assumes authentication middleware
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
  }
  
  const authService = await Effect.runPromise(AuthService);
  await runEffect(authService.switchAuthMethod(userId, req.body), res);
});

// Get user authentication status
router.get('/status', async (req, res) => {
  const userId = req.user?.id; // Assumes authentication middleware
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
  }
  
  const authService = await Effect.runPromise(AuthService);
  await runEffect(authService.getUserAuthStatus(userId), res);
});

// Logout
router.post('/logout', async (req, res) => {
  const sessionToken = req.cookies.session_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(400).json({
      success: false,
      error: 'No session token provided',
      code: 'VALIDATION_ERROR',
    });
  }
  
  const sessionService = await Effect.runPromise(SessionService);
  await runEffect(sessionService.deleteSession(sessionToken), res);
  
  // Clear session cookie
  res.clearCookie('session_token');
});

// Get current user from session
router.get('/me', async (req, res) => {
  const sessionToken = req.cookies.session_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(401).json({
      success: false,
      error: 'No session token provided',
      code: 'UNAUTHORIZED',
    });
  }
  
  const authService = await Effect.runPromise(AuthService);
  const user = await runEffect(authService.getUserBySession(sessionToken), res);
  
  if (!user) {
    res.clearCookie('session_token');
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session',
      code: 'SESSION_EXPIRED',
    });
  }
});

// Password reset request
router.post('/password-reset/request', otpLimiter, async (req, res) => {
  const { email } = req.body;
  // This would be implemented in PasswordAuthService
  // For now, return a placeholder response
  res.json({
    success: true,
    data: { message: 'If an account with this email exists, a password reset link has been sent.' },
  });
});

// Password reset completion
router.post('/password-reset/complete', async (req, res) => {
  const { token, newPassword } = req.body;
  // This would be implemented in PasswordAuthService
  // For now, return a placeholder response
  res.json({
    success: true,
    data: { message: 'Password reset successfully.' },
  });
});

// Change password (authenticated)
router.post('/change-password', async (req, res) => {
  const userId = req.user?.id; // Assumes authentication middleware
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
  }
  
  const { currentPassword, newPassword } = req.body;
  // This would be implemented in PasswordAuthService
  // For now, return a placeholder response
  res.json({
    success: true,
    data: { message: 'Password changed successfully.' },
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      features: {
        passwordAuth: true,
        webauthn: true,
        emailVerification: true,
        otp: true,
      },
    },
  });
});

export default router;

