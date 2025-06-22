const User = require('../models/User');

/**
 * Authentication middleware to protect routes
 */
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Get user from database
    const user = await User.findById(req.session.userId);
    if (!user || !user.isActive) {
      req.session.destroy();
      return res.status(401).json({ 
        error: 'User not found or inactive',
        code: 'USER_INVALID'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional authentication middleware - doesn't block if not authenticated
 */
const optionalAuth = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user && user.isActive) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

/**
 * Middleware to require specific authentication method
 */
const requireAuthMethod = (method) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (req.user.authMethod !== method) {
      return res.status(403).json({ 
        error: `This action requires ${method} authentication`,
        code: 'AUTH_METHOD_MISMATCH',
        currentMethod: req.user.authMethod,
        requiredMethod: method
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is already authenticated
 */
const requireGuest = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.status(400).json({ 
      error: 'Already authenticated',
      code: 'ALREADY_AUTHENTICATED'
    });
  }
  next();
};

/**
 * Create session for user
 */
const createSession = (req, user, authMethod) => {
  req.session.userId = user.id;
  req.session.authMethod = authMethod;
  req.session.loginTime = new Date();
  
  // Regenerate session ID for security
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
      } else {
        req.session.userId = user.id;
        req.session.authMethod = authMethod;
        req.session.loginTime = new Date();
        resolve();
      }
    });
  });
};

/**
 * Destroy session
 */
const destroySession = (req) => {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireAuthMethod,
  requireGuest,
  createSession,
  destroySession,
};

