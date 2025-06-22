const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('Email service configuration error:', error);
      } else {
        console.log('Email service is ready to send messages');
      }
    });
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(email, token) {
    const verificationUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Email Address</h2>
          <p>Thank you for registering! Please click the button below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours. If you didn't create an account, please ignore this email.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Email verification sent to ${email}`);
    } catch (error) {
      console.error('Failed to send email verification:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send login OTP
   */
  async sendLoginOTP(email, otp) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
      to: email,
      subject: 'Your Login Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your Login Code</h2>
          <p>Use the following code to complete your login:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f8f9fa; border: 2px solid #007bff; 
                        border-radius: 8px; padding: 20px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; color: #007bff; 
                           letter-spacing: 5px;">${otp}</span>
            </div>
          </div>
          <p style="color: #666; font-size: 14px;">
            This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Login OTP sent to ${email}`);
    } catch (error) {
      console.error('Failed to send login OTP:', error);
      throw new Error('Failed to send login code');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email, token) {
    const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
      to: email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>You requested to reset your password. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send authentication method change notification
   */
  async sendAuthMethodChangeNotification(email, newMethod) {
    const methodName = newMethod === 'webauthn' ? 'Passkeys (WebAuthn)' : 'Email/Password';
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
      to: email,
      subject: 'Authentication Method Changed',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Authentication Method Changed</h2>
          <p>Your authentication method has been successfully changed to: <strong>${methodName}</strong></p>
          <p style="color: #666; font-size: 14px;">
            If you didn't make this change, please contact support immediately.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Auth method change notification sent to ${email}`);
    } catch (error) {
      console.error('Failed to send auth method change notification:', error);
      // Don't throw error for notifications
    }
  }
}

module.exports = EmailService;

