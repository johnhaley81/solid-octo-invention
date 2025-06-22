const OTPService = require('./OTPService');
const EmailService = require('./EmailService');
const PasswordCredential = require('../models/PasswordCredential');

class PasswordAuthService {
  constructor() {
    this.otpService = new OTPService();
    this.emailService = new EmailService();
  }

  /**
   * Send email verification OTP
   */
  async sendEmailVerification(user, passwordCredential) {
    // Generate verification token
    const token = this.otpService.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in password credentials
    await passwordCredential.setEmailVerificationToken(token, expiresAt);

    // Send email
    await this.emailService.sendEmailVerification(user.email, token);

    return { message: 'Verification email sent' };
  }

  /**
   * Send login OTP
   */
  async sendLoginOTP(user) {
    // Generate OTP
    const otp = this.otpService.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    await this.otpService.createOTP(user.id, otp, 'login_otp', expiresAt);

    // Send email
    await this.emailService.sendLoginOTP(user.email, otp);

    return { message: 'OTP sent to your email' };
  }

  /**
   * Verify email verification token
   */
  async verifyEmailToken(token) {
    // Find password credential with this token
    const query = `
      SELECT pc.*, u.email 
      FROM password_credentials pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.email_verification_token = $1 
      AND pc.email_verification_expires > CURRENT_TIMESTAMP
      AND pc.email_verified = false
    `;
    
    const db = require('../config/database');
    const result = await db.query(query, [token]);
    
    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification token');
    }

    const credentialData = result.rows[0];
    const passwordCredential = new PasswordCredential(credentialData);

    // Mark email as verified
    await passwordCredential.verifyEmail();

    return {
      message: 'Email verified successfully',
      email: credentialData.email
    };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(userId, otpToken, tokenType) {
    return await this.otpService.verifyOTP(userId, otpToken, tokenType);
  }

  /**
   * Initiate password reset
   */
  async initiatePasswordReset(email) {
    const User = require('../models/User');
    const user = await User.findByEmail(email);
    
    if (!user || user.authMethod !== 'password') {
      // Don't reveal if user exists or not
      return { message: 'If an account with this email exists, a password reset link has been sent.' };
    }

    const passwordCredential = await PasswordCredential.findByUserId(user.id);
    if (!passwordCredential || !passwordCredential.emailVerified) {
      return { message: 'If an account with this email exists, a password reset link has been sent.' };
    }

    // Generate reset token
    const resetToken = this.otpService.generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    const query = `
      UPDATE password_credentials 
      SET password_reset_token = $1, password_reset_expires = $2, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
    `;
    const db = require('../config/database');
    await db.query(query, [resetToken, expiresAt, user.id]);

    // Send reset email
    await this.emailService.sendPasswordReset(user.email, resetToken);

    return { message: 'If an account with this email exists, a password reset link has been sent.' };
  }

  /**
   * Complete password reset
   */
  async completePasswordReset(token, newPassword) {
    // Find password credential with this reset token
    const query = `
      SELECT pc.*, u.email 
      FROM password_credentials pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.password_reset_token = $1 
      AND pc.password_reset_expires > CURRENT_TIMESTAMP
    `;
    
    const db = require('../config/database');
    const result = await db.query(query, [token]);
    
    if (result.rows.length === 0) {
      throw new Error('Invalid or expired reset token');
    }

    const credentialData = result.rows[0];
    const passwordCredential = new PasswordCredential(credentialData);

    // Update password and clear reset token
    await passwordCredential.updatePassword(newPassword);
    
    const clearTokenQuery = `
      UPDATE password_credentials 
      SET password_reset_token = NULL, password_reset_expires = NULL, 
          failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await db.query(clearTokenQuery, [passwordCredential.id]);

    return {
      message: 'Password reset successfully',
      email: credentialData.email
    };
  }

  /**
   * Change password (for authenticated users)
   */
  async changePassword(userId, currentPassword, newPassword) {
    const passwordCredential = await PasswordCredential.findByUserId(userId);
    if (!passwordCredential) {
      throw new Error('Password authentication not set up for this user');
    }

    // Verify current password
    const isValidPassword = await passwordCredential.verifyPassword(currentPassword);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Update to new password
    await passwordCredential.updatePassword(newPassword);

    return { message: 'Password changed successfully' };
  }
}

module.exports = PasswordAuthService;

