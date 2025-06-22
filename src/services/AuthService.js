const User = require('../models/User');
const PasswordCredential = require('../models/PasswordCredential');
const WebAuthnCredential = require('../models/WebAuthnCredential');
const PasswordAuthService = require('./PasswordAuthService');
const WebAuthnService = require('./WebAuthnService');
const db = require('../config/database');

class AuthService {
  constructor() {
    this.passwordAuthService = new PasswordAuthService();
    this.webAuthnService = new WebAuthnService();
  }

  /**
   * Register a new user with email/password authentication
   */
  async registerWithPassword(email, password) {
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Create user with password auth method
      const user = await User.create(email, 'password');
      
      // Create password credentials
      const passwordCredential = await PasswordCredential.create(user.id, password);
      
      // Send email verification
      await this.passwordAuthService.sendEmailVerification(user, passwordCredential);

      await client.query('COMMIT');
      
      return {
        user: user.toJSON(),
        requiresEmailVerification: true
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Login with email/password + OTP
   */
  async loginWithPassword(email, password, otpToken = null) {
    const user = await User.findByEmail(email);
    if (!user || user.authMethod !== 'password') {
      throw new Error('Invalid credentials');
    }

    const passwordCredential = await PasswordCredential.findByUserId(user.id);
    if (!passwordCredential) {
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (passwordCredential.isLocked()) {
      throw new Error('Account is temporarily locked due to too many failed attempts');
    }

    // Verify password
    const isValidPassword = await passwordCredential.verifyPassword(password);
    if (!isValidPassword) {
      await passwordCredential.incrementFailedAttempts();
      throw new Error('Invalid credentials');
    }

    // Check email verification
    if (!passwordCredential.emailVerified) {
      throw new Error('Email not verified. Please check your email for verification link.');
    }

    // If no OTP provided, send OTP and require it
    if (!otpToken) {
      await this.passwordAuthService.sendLoginOTP(user);
      return {
        requiresOTP: true,
        message: 'OTP sent to your email'
      };
    }

    // Verify OTP
    const isValidOTP = await this.passwordAuthService.verifyOTP(user.id, otpToken, 'login_otp');
    if (!isValidOTP) {
      throw new Error('Invalid or expired OTP');
    }

    // Reset failed attempts on successful login
    await passwordCredential.resetFailedAttempts();

    return {
      user: user.toJSON(),
      authMethod: 'password'
    };
  }

  /**
   * Begin WebAuthn registration process
   */
  async beginWebAuthnRegistration(email) {
    let user = await User.findByEmail(email);
    
    // If user doesn't exist, create them with webauthn method
    if (!user) {
      user = await User.create(email, 'webauthn');
    } else if (user.authMethod === 'password') {
      // Switch from password to webauthn - this will disable password auth
      await this.switchToWebAuthn(user.id);
    }

    const registrationOptions = await this.webAuthnService.generateRegistrationOptions(user);
    return {
      user: user.toJSON(),
      registrationOptions
    };
  }

  /**
   * Complete WebAuthn registration
   */
  async completeWebAuthnRegistration(userId, registrationResponse) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const credential = await this.webAuthnService.verifyRegistration(user, registrationResponse);
    
    return {
      user: user.toJSON(),
      credential: credential.toJSON()
    };
  }

  /**
   * Begin WebAuthn authentication
   */
  async beginWebAuthnAuthentication(email) {
    const user = await User.findByEmail(email);
    if (!user || user.authMethod !== 'webauthn') {
      throw new Error('WebAuthn not enabled for this user');
    }

    const authenticationOptions = await this.webAuthnService.generateAuthenticationOptions(user);
    return {
      user: user.toJSON(),
      authenticationOptions
    };
  }

  /**
   * Complete WebAuthn authentication
   */
  async completeWebAuthnAuthentication(userId, authenticationResponse) {
    const user = await User.findById(userId);
    if (!user || user.authMethod !== 'webauthn') {
      throw new Error('WebAuthn not enabled for this user');
    }

    const isValid = await this.webAuthnService.verifyAuthentication(user, authenticationResponse);
    if (!isValid) {
      throw new Error('WebAuthn authentication failed');
    }

    return {
      user: user.toJSON(),
      authMethod: 'webauthn'
    };
  }

  /**
   * Switch user from password to WebAuthn authentication
   * This implements the mutual exclusivity requirement
   */
  async switchToWebAuthn(userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.authMethod === 'webauthn') {
        throw new Error('User is already using WebAuthn authentication');
      }

      // Update user's auth method
      await user.updateAuthMethod('webauthn');

      // Delete password credentials (mutual exclusivity)
      const passwordCredential = await PasswordCredential.findByUserId(userId);
      if (passwordCredential) {
        await passwordCredential.delete();
      }

      await client.query('COMMIT');
      
      return user.toJSON();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Switch user from WebAuthn to password authentication
   * This implements the mutual exclusivity requirement
   */
  async switchToPassword(userId, newPassword) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.authMethod === 'password') {
        throw new Error('User is already using password authentication');
      }

      // Update user's auth method
      await user.updateAuthMethod('password');

      // Delete WebAuthn credentials (mutual exclusivity)
      await WebAuthnCredential.deleteAllByUserId(userId);

      // Create new password credentials
      const passwordCredential = await PasswordCredential.create(userId, newPassword);
      
      // Send email verification for new password setup
      await this.passwordAuthService.sendEmailVerification(user, passwordCredential);

      await client.query('COMMIT');
      
      return {
        user: user.toJSON(),
        requiresEmailVerification: true
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's current authentication method and status
   */
  async getUserAuthStatus(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const status = {
      user: user.toJSON(),
      authMethod: user.authMethod
    };

    if (user.authMethod === 'password') {
      const passwordCredential = await PasswordCredential.findByUserId(userId);
      status.passwordAuth = {
        emailVerified: passwordCredential?.emailVerified || false,
        isLocked: passwordCredential?.isLocked() || false,
        failedAttempts: passwordCredential?.failedLoginAttempts || 0
      };
    } else if (user.authMethod === 'webauthn') {
      const credentials = await WebAuthnCredential.findByUserId(userId);
      status.webauthnAuth = {
        credentialCount: credentials.length,
        credentials: credentials.map(cred => ({
          id: cred.id,
          deviceType: cred.deviceType,
          createdAt: cred.createdAt,
          lastUsed: cred.lastUsed
        }))
      };
    }

    return status;
  }

  /**
   * Verify email for password authentication
   */
  async verifyEmail(token) {
    return await this.passwordAuthService.verifyEmailToken(token);
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(email) {
    const user = await User.findByEmail(email);
    if (!user || user.authMethod !== 'password') {
      throw new Error('Invalid request');
    }

    const passwordCredential = await PasswordCredential.findByUserId(user.id);
    if (!passwordCredential) {
      throw new Error('Invalid request');
    }

    if (passwordCredential.emailVerified) {
      throw new Error('Email is already verified');
    }

    await this.passwordAuthService.sendEmailVerification(user, passwordCredential);
    return { message: 'Verification email sent' };
  }
}

module.exports = AuthService;

