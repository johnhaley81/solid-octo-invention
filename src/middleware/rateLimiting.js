const rateLimit = require('express-rate-limit');

/**
 * General rate limiting for all requests
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiting for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Very strict rate limiting for password reset
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    error: 'Too many password reset attempts',
    code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting for email verification requests
 */
const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 email verification requests per hour
  message: {
    error: 'Too many email verification requests',
    code: 'EMAIL_VERIFICATION_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting for OTP requests
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OTP requests per 15 minutes
  message: {
    error: 'Too many OTP requests',
    code: 'OTP_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting for WebAuthn operations
 */
const webauthnLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 WebAuthn operations per 15 minutes
  message: {
    error: 'Too many WebAuthn requests',
    code: 'WEBAUTHN_RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Custom rate limiter that uses user ID instead of IP
 */
const createUserBasedLimiter = (windowMs, max, message) => {
  const store = new Map();
  
  return (req, res, next) => {
    const userId = req.user?.id || req.session?.userId;
    if (!userId) {
      return next(); // Skip if no user ID available
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [key, data] of store.entries()) {
      if (data.resetTime < now) {
        store.delete(key);
      }
    }

    // Get or create user's rate limit data
    let userData = store.get(userId);
    if (!userData || userData.resetTime < now) {
      userData = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(userId, userData);
    }

    // Check if limit exceeded
    if (userData.count >= max) {
      return res.status(429).json({
        ...message,
        retryAfter: Math.ceil((userData.resetTime - now) / 1000),
      });
    }

    // Increment counter
    userData.count++;
    next();
  };
};

/**
 * User-based rate limiter for sensitive operations
 */
const userSensitiveLimiter = createUserBasedLimiter(
  60 * 60 * 1000, // 1 hour
  5, // 5 attempts per hour per user
  {
    error: 'Too many attempts for this account',
    code: 'USER_RATE_LIMIT_EXCEEDED',
  }
);

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  otpLimiter,
  webauthnLimiter,
  userSensitiveLimiter,
  createUserBasedLimiter,
};

