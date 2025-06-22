const express = require('express');
const AuthService = require('../services/AuthService');
const { validators } = require('../middleware/validation');
const { userSensitiveLimiter } = require('../middleware/rateLimiting');
const { requireAuth, requireAuthMethod } = require('../middleware/auth');

const router = express.Router();
const authService = new AuthService();

/**
 * Change password (for password-authenticated users)
 */
router.post('/change-password',
  requireAuth,
  requireAuthMethod('password'),
  userSensitiveLimiter,
  validators.changePassword,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.passwordAuthService.changePassword(
        req.user.id, 
        currentPassword, 
        newPassword
      );
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(400).json({
        error: error.message,
        code: 'CHANGE_PASSWORD_FAILED'
      });
    }
  }
);

/**
 * Switch from password to WebAuthn authentication
 */
router.post('/switch-to-webauthn',
  requireAuth,
  requireAuthMethod('password'),
  userSensitiveLimiter,
  async (req, res) => {
    try {
      const result = await authService.switchToWebAuthn(req.user.id);
      
      res.json({
        success: true,
        message: 'Successfully switched to WebAuthn authentication',
        user: result
      });
    } catch (error) {
      console.error('Switch to WebAuthn error:', error);
      res.status(400).json({
        error: error.message,
        code: 'SWITCH_TO_WEBAUTHN_FAILED'
      });
    }
  }
);

/**
 * Switch from WebAuthn to password authentication
 */
router.post('/switch-to-password',
  requireAuth,
  requireAuthMethod('webauthn'),
  userSensitiveLimiter,
  validators.switchToPassword,
  async (req, res) => {
    try {
      const { password } = req.body;
      const result = await authService.switchToPassword(req.user.id, password);
      
      res.json({
        success: true,
        message: 'Successfully switched to password authentication',
        data: result
      });
    } catch (error) {
      console.error('Switch to password error:', error);
      res.status(400).json({
        error: error.message,
        code: 'SWITCH_TO_PASSWORD_FAILED'
      });
    }
  }
);

/**
 * Get user's WebAuthn credentials
 */
router.get('/webauthn/credentials',
  requireAuth,
  requireAuthMethod('webauthn'),
  async (req, res) => {
    try {
      const credentials = await authService.webAuthnService.getUserCredentials(req.user.id);
      
      res.json({
        success: true,
        data: {
          credentials,
          count: credentials.length
        }
      });
    } catch (error) {
      console.error('Get WebAuthn credentials error:', error);
      res.status(500).json({
        error: 'Failed to get WebAuthn credentials',
        code: 'GET_WEBAUTHN_CREDENTIALS_FAILED'
      });
    }
  }
);

/**
 * Delete a WebAuthn credential
 */
router.delete('/webauthn/credentials/:credentialId',
  requireAuth,
  requireAuthMethod('webauthn'),
  userSensitiveLimiter,
  async (req, res) => {
    try {
      const { credentialId } = req.params;
      const result = await authService.webAuthnService.deleteCredential(req.user.id, credentialId);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Delete WebAuthn credential error:', error);
      res.status(400).json({
        error: error.message,
        code: 'DELETE_WEBAUTHN_CREDENTIAL_FAILED'
      });
    }
  }
);

/**
 * Add additional WebAuthn credential (for users already using WebAuthn)
 */
router.post('/webauthn/add-credential/begin',
  requireAuth,
  requireAuthMethod('webauthn'),
  async (req, res) => {
    try {
      const registrationOptions = await authService.webAuthnService.generateRegistrationOptions(req.user);
      
      // Store challenge in session
      req.session.webauthnChallenge = registrationOptions.challenge;
      
      res.json({
        success: true,
        options: registrationOptions
      });
    } catch (error) {
      console.error('Add WebAuthn credential begin error:', error);
      res.status(400).json({
        error: error.message,
        code: 'ADD_WEBAUTHN_CREDENTIAL_BEGIN_FAILED'
      });
    }
  }
);

/**
 * Complete adding additional WebAuthn credential
 */
router.post('/webauthn/add-credential/complete',
  requireAuth,
  requireAuthMethod('webauthn'),
  async (req, res) => {
    try {
      const { registrationResponse } = req.body;
      
      if (!req.session.webauthnChallenge) {
        throw new Error('No active registration session');
      }
      
      const result = await authService.completeWebAuthnRegistration(req.user.id, registrationResponse);
      
      // Clear session data
      delete req.session.webauthnChallenge;
      
      res.json({
        success: true,
        message: 'Additional WebAuthn credential added successfully',
        credential: result.credential
      });
    } catch (error) {
      console.error('Add WebAuthn credential complete error:', error);
      res.status(400).json({
        error: error.message,
        code: 'ADD_WEBAUTHN_CREDENTIAL_COMPLETE_FAILED'
      });
    }
  }
);

/**
 * Get user profile and authentication status
 */
router.get('/profile',
  requireAuth,
  async (req, res) => {
    try {
      const authStatus = await authService.getUserAuthStatus(req.user.id);
      
      res.json({
        success: true,
        data: authStatus
      });
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({
        error: 'Failed to get user profile',
        code: 'GET_USER_PROFILE_FAILED'
      });
    }
  }
);

/**
 * Deactivate user account
 */
router.post('/deactivate',
  requireAuth,
  userSensitiveLimiter,
  async (req, res) => {
    try {
      await req.user.deactivate();
      
      // Destroy session
      req.session.destroy();
      
      res.json({
        success: true,
        message: 'Account deactivated successfully'
      });
    } catch (error) {
      console.error('Deactivate account error:', error);
      res.status(500).json({
        error: 'Failed to deactivate account',
        code: 'DEACTIVATE_ACCOUNT_FAILED'
      });
    }
  }
);

module.exports = router;

