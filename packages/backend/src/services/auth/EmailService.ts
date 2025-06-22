/**
 * Email service using Effect-TS
 * Handles sending authentication-related emails
 */

import { Effect, Layer, Context } from 'effect';
import nodemailer from 'nodemailer';
import {
  createEmailServiceError,
  createConfigurationError,
  type AuthError,
} from '@solid-octo-invention/shared';

export interface EmailService {
  readonly sendEmailVerification: (email: string, token: string) => Effect.Effect<void, AuthError>;
  readonly sendLoginOTP: (email: string, otp: string) => Effect.Effect<void, AuthError>;
  readonly sendPasswordReset: (email: string, token: string) => Effect.Effect<void, AuthError>;
  readonly sendAuthMethodChangeNotification: (
    email: string,
    newMethod: 'password' | 'webauthn',
  ) => Effect.Effect<void, AuthError>;
}

export const EmailService = Context.GenericTag<EmailService>('EmailService');

const make = Effect.gen(function* () {
  // Get email configuration from environment
  const emailConfig = {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  const fromEmail = process.env.FROM_EMAIL || 'noreply@solid-octo-invention.com';
  const appName = process.env.APP_NAME || 'Solid Octo Invention';
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  // Validate required configuration
  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    yield* Effect.fail(
      createConfigurationError(
        'email',
        'SMTP_USER and SMTP_PASS environment variables are required',
      ),
    );
  }

  const createTransporter = () =>
    Effect.tryPromise({
      try: () => nodemailer.createTransporter(emailConfig),
      catch: (error) =>
        createConfigurationError('email', `Failed to create email transporter: ${error}`),
    });

  const sendEmail = (to: string, subject: string, html: string) =>
    Effect.gen(function* () {
      const transporter = yield* createTransporter();

      yield* Effect.tryPromise({
        try: () =>
          transporter.sendMail({
            from: fromEmail,
            to,
            subject,
            html,
          }),
        catch: (error) =>
          createEmailServiceError('send', `Failed to send email: ${error}`),
      });
    });

  const sendEmailVerification = (email: string, token: string) =>
    Effect.gen(function* () {
      const verificationUrl = `${appUrl}/verify-email?token=${token}`;
      
      const subject = `Verify your email address - ${appName}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6c757d; }
            .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .button:hover { background: #0056b3; }
            .code { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 16px; letter-spacing: 2px; text-align: center; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${appName}</h1>
              <h2>Email Verification</h2>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Thank you for registering with ${appName}! To complete your registration, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #007bff;">${verificationUrl}</p>
              
              <p><strong>This verification link will expire in 24 hours.</strong></p>
              
              <p>If you didn't create an account with ${appName}, you can safely ignore this email.</p>
              
              <p>Best regards,<br>The ${appName} Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      yield* sendEmail(email, subject, html);
    });

  const sendLoginOTP = (email: string, otp: string) =>
    Effect.gen(function* () {
      const subject = `Your login code - ${appName}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Login Code</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6c757d; }
            .code { background: #f8f9fa; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0; border: 2px solid #007bff; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${appName}</h1>
              <h2>Login Verification Code</h2>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You requested to log in to your ${appName} account. Please use the verification code below to complete your login:</p>
              
              <div class="code">${otp}</div>
              
              <p><strong>This code will expire in 10 minutes.</strong></p>
              
              <p>If you didn't request this login, please ignore this email and consider changing your password.</p>
              
              <p>Best regards,<br>The ${appName} Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      yield* sendEmail(email, subject, html);
    });

  const sendPasswordReset = (email: string, token: string) =>
    Effect.gen(function* () {
      const resetUrl = `${appUrl}/reset-password?token=${token}`;
      
      const subject = `Reset your password - ${appName}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6c757d; }
            .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .button:hover { background: #c82333; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${appName}</h1>
              <h2>Password Reset Request</h2>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You requested to reset your password for your ${appName} account. Click the button below to create a new password:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #dc3545;">${resetUrl}</p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul>
                  <li>This reset link will expire in 1 hour</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Consider enabling two-factor authentication for better security</li>
                </ul>
              </div>
              
              <p>Best regards,<br>The ${appName} Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      yield* sendEmail(email, subject, html);
    });

  const sendAuthMethodChangeNotification = (email: string, newMethod: 'password' | 'webauthn') =>
    Effect.gen(function* () {
      const methodName = newMethod === 'webauthn' ? 'WebAuthn Passkeys' : 'Email/Password';
      
      const subject = `Authentication method changed - ${appName}`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Authentication Method Changed</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e9ecef; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 14px; color: #6c757d; }
            .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${appName}</h1>
              <h2>Authentication Method Changed</h2>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>This email confirms that your authentication method has been successfully changed.</p>
              
              <div class="info">
                <strong>New Authentication Method:</strong> ${methodName}
                <br><strong>Changed on:</strong> ${new Date().toLocaleString()}
              </div>
              
              ${newMethod === 'password' ? `
                <div class="warning">
                  <strong>📧 Email Verification Required</strong>
                  <p>Since you switched to email/password authentication, you'll need to verify your email address before you can log in. Please check your inbox for a verification email.</p>
                </div>
              ` : `
                <div class="info">
                  <strong>🔐 WebAuthn Passkeys Active</strong>
                  <p>You can now use biometric authentication (Touch ID, Face ID, Windows Hello) or security keys to log in to your account.</p>
                </div>
              `}
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <p>If you didn't make this change, please contact our support team immediately. Your previous authentication method has been disabled for security.</p>
              </div>
              
              <p>Best regards,<br>The ${appName} Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      yield* sendEmail(email, subject, html);
    });

  return {
    sendEmailVerification,
    sendLoginOTP,
    sendPasswordReset,
    sendAuthMethodChangeNotification,
  } as const;
});

export const EmailServiceLive = Layer.effect(EmailService, make);

