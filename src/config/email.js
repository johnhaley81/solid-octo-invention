require('dotenv').config();

const emailConfig = {
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
  templates: {
    emailVerification: {
      subject: 'Verify Your Email Address',
      expiryHours: 24,
    },
    loginOtp: {
      subject: 'Your Login Code',
      expiryMinutes: 10,
    },
    passwordReset: {
      subject: 'Reset Your Password',
      expiryHours: 1,
    },
    authMethodChange: {
      subject: 'Authentication Method Changed',
    },
  },
  rateLimits: {
    emailVerification: {
      maxPerHour: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
    loginOtp: {
      maxPer15Min: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
    },
    passwordReset: {
      maxPerHour: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
    },
  },
};

// Validate email configuration
function validateEmailConfig() {
  const errors = [];

  if (!emailConfig.smtp.auth.user) {
    errors.push('SMTP_USER is required for email functionality');
  }

  if (!emailConfig.smtp.auth.pass) {
    errors.push('SMTP_PASS is required for email functionality');
  }

  if (!emailConfig.from) {
    errors.push('FROM_EMAIL is required for email functionality');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailConfig.from && !emailRegex.test(emailConfig.from)) {
    errors.push('FROM_EMAIL must be a valid email address');
  }

  if (errors.length > 0) {
    console.warn('Email configuration warnings:');
    errors.forEach(error => console.warn(`- ${error}`));
    console.warn('Email functionality may not work properly.');
  }

  return errors.length === 0;
}

// Test email configuration
async function testEmailConfig() {
  const nodemailer = require('nodemailer');
  
  try {
    const transporter = nodemailer.createTransporter(emailConfig.smtp);
    await transporter.verify();
    console.log('✅ Email configuration is valid');
    return true;
  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    return false;
  }
}

module.exports = {
  emailConfig,
  validateEmailConfig,
  testEmailConfig,
};

