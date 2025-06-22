const express = require('express');
const AuthService = require('../services/AuthService');
const { validators } = require('../middleware/validation');
const { 
  authLimiter, 
  passwordResetLimiter, 
  emailVerificationLimiter,
  otpLimiter,
  webauthnLimiter 
} = require('../middleware/rateLimiting');
const { 
  requireAuth, 
  requireGuest, 
  createSession, 
  destroySession 
} = require('../middleware/auth');

const router = express.Router();
const authService = new AuthService();

/**
 * Register with email/password
 */
router.post('/register', 
  authLimiter,
  requireGuest,
  validators.register,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await authService.registerWithPassword(email, password);
      
      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email for verification.',
        data: result
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({
        error: error.message,
        code: 'REGISTRATION_FAILED'
      });
    }
  }
);

/**
 * Login with email/password (+ OTP)
 */
router.post('/login',
  authLimiter,
  requireGuest,
  validators.login,
  async (req, res) => {
    try {
      const { email, password, otp } = req.body;
      const result = await authService.loginWithPassword(email, password, otp);
      
      if (result.requiresOTP) {
        return res.json({
          success: true,
          requiresOTP: true,
          message: result.message
        });
      }

      // Create session
      await createSession(req, result.user, result.authMethod);
      
      res.json({
        success: true,
        message: 'Login successful',
        user: result.user
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        error: error.message,
        code: 'LOGIN_FAILED'
      });
    }
  }
);

/**
 * Verify email
 */
router.post('/verify-email',
  emailVerificationLimiter,
  validators.verifyEmail,
  async (req, res) => {
    try {
      const { token } = req.body;
      const result = await authService.verifyEmail(token);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(400).json({
        error: error.message,
        code: 'EMAIL_VERIFICATION_FAILED'
      });
    }
  }
);

/**
 * Resend email verification
 */
router.post('/resend-verification',
  emailVerificationLimiter,
  validators.passwordResetRequest, // Reuse email validation
  async (req, res) => {
    try {
      const { email } = req.body;
      const result = await authService.resendEmailVerification(email);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(400).json({
        error: error.message,
        code: 'RESEND_VERIFICATION_FAILED'
      });
    }
  }
);

/**
 * Request password reset
 */
router.post('/password-reset/request',
  passwordResetLimiter,
  validators.passwordResetRequest,
  async (req, res) => {
    try {
      const { email } = req.body;
      const result = await authService.passwordAuthService.initiatePasswordReset(email);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(400).json({
        error: error.message,
        code: 'PASSWORD_RESET_REQUEST_FAILED'
      });
    }
  }
);

/**
 * Complete password reset
 */
router.post('/password-reset/complete',
  authLimiter,
  validators.passwordResetComplete,
  async (req, res) => {
    try {
      const { token, password } = req.body;
      const result = await authService.passwordAuthService.completePasswordReset(token, password);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Password reset completion error:', error);
      res.status(400).json({
        error: error.message,
        code: 'PASSWORD_RESET_COMPLETION_FAILED'
      });
    }
  }
);

/**
 * Begin WebAuthn registration
 */
router.post('/webauthn/register/begin',
  webauthnLimiter,
  validators.webauthnRegisterBegin,
  async (req, res) => {
    try {
      const { email } = req.body;
      const result = await authService.beginWebAuthnRegistration(email);
      
      // Store user ID in session for completion
      req.session.webauthnUserId = result.user.id;
      
      res.json({
        success: true,
        user: result.user,
        options: result.registrationOptions
      });
    } catch (error) {
      console.error('WebAuthn registration begin error:', error);
      res.status(400).json({
        error: error.message,
        code: 'WEBAUTHN_REGISTRATION_BEGIN_FAILED'
      });
    }
  }
);

/**
 * Complete WebAuthn registration
 */
router.post('/webauthn/register/complete',
  webauthnLimiter,
  validators.webauthnRegisterComplete,
  async (req, res) => {
    try {
      const { userId, registrationResponse } = req.body;
      
      // Verify user ID matches session
      if (req.session.webauthnUserId !== userId) {
        throw new Error('Invalid registration session');
      }
      
      const result = await authService.completeWebAuthnRegistration(userId, registrationResponse);
      
      // Clear session data
      delete req.session.webauthnUserId;
      
      // Create authenticated session
      await createSession(req, result.user, 'webauthn');
      
      res.json({
        success: true,
        message: 'WebAuthn registration successful',
        user: result.user
      });
    } catch (error) {
      console.error('WebAuthn registration complete error:', error);
      res.status(400).json({
        error: error.message,
        code: 'WEBAUTHN_REGISTRATION_COMPLETE_FAILED'
      });
    }
  }
);

/**
 * Begin WebAuthn authentication
 */
router.post('/webauthn/authenticate/begin',
  webauthnLimiter,
  requireGuest,
  validators.webauthnAuthBegin,
  async (req, res) => {
    try {
      const { email } = req.body;
      const result = await authService.beginWebAuthnAuthentication(email);
      
      // Store user ID in session for completion
      req.session.webauthnUserId = result.user.id;
      
      res.json({
        success: true,
        user: result.user,
        options: result.authenticationOptions
      });
    } catch (error) {
      console.error('WebAuthn authentication begin error:', error);
      res.status(400).json({
        error: error.message,
        code: 'WEBAUTHN_AUTHENTICATION_BEGIN_FAILED'
      });
    }
  }
);

/**
 * Complete WebAuthn authentication
 */
router.post('/webauthn/authenticate/complete',
  webauthnLimiter,
  validators.webauthnAuthComplete,
  async (req, res) => {
    try {
      const { userId, authenticationResponse } = req.body;
      
      // Verify user ID matches session
      if (req.session.webauthnUserId !== userId) {
        throw new Error('Invalid authentication session');
      }
      
      const result = await authService.completeWebAuthnAuthentication(userId, authenticationResponse);
      
      // Clear session data
      delete req.session.webauthnUserId;
      
      // Create authenticated session
      await createSession(req, result.user, result.authMethod);
      
      res.json({
        success: true,
        message: 'WebAuthn authentication successful',
        user: result.user
      });
    } catch (error) {
      console.error('WebAuthn authentication complete error:', error);
      res.status(401).json({
        error: error.message,
        code: 'WEBAUTHN_AUTHENTICATION_COMPLETE_FAILED'
      });
    }
  }
);

/**
 * Logout
 */
router.post('/logout',
  requireAuth,
  async (req, res) => {
    try {
      await destroySession(req);
      
      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: 'Logout failed',
        code: 'LOGOUT_FAILED'
      });
    }
  }
);

/**
 * Get current user session info
 */
router.get('/me',
  requireAuth,
  async (req, res) => {
    try {
      const authStatus = await authService.getUserAuthStatus(req.user.id);
      
      res.json({
        success: true,
        data: {
          ...authStatus,
          session: {
            loginTime: req.session.loginTime,
            authMethod: req.session.authMethod
          }
        }
      });
    } catch (error) {
      console.error('Get user info error:', error);
      res.status(500).json({
        error: 'Failed to get user information',
        code: 'GET_USER_INFO_FAILED'
      });
    }
  }
);

module.exports = router;

