/**
 * Authentication middleware for Express
 * Handles session validation and user context
 */

import { Request, Response, NextFunction } from 'express';
import { Effect } from 'effect';
import { SessionService } from '../services/auth/SessionService.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        authMethod: 'password' | 'webauthn';
        createdAt: string;
        updatedAt: string;
      };
      session?: {
        sessionId: string;
        userId: string;
        authMethod: 'password' | 'webauthn';
        ipAddress?: string;
        userAgent?: string;
        expiresAt: string;
        createdAt: string;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using session tokens
 * Adds user and session information to the request object
 */
export const authenticateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get session token from cookie or Authorization header
    const sessionToken = req.cookies.session_token || 
                        req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate session
    const sessionService = await Effect.runPromise(SessionService);
    const sessionData = await Effect.runPromise(sessionService.validateSession(sessionToken));

    if (!sessionData) {
      // Clear invalid session cookie
      res.clearCookie('session_token');
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session',
        code: 'SESSION_EXPIRED',
      });
    }

    // Add user and session to request
    req.user = sessionData.user;
    req.session = {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      authMethod: sessionData.authMethod,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      expiresAt: sessionData.expiresAt,
      createdAt: sessionData.createdAt,
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user information if session is valid, but doesn't require authentication
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies.session_token || 
                        req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return next();
    }

    const sessionService = await Effect.runPromise(SessionService);
    const sessionData = await Effect.runPromise(sessionService.validateSession(sessionToken));

    if (sessionData) {
      req.user = sessionData.user;
      req.session = {
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        authMethod: sessionData.authMethod,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        expiresAt: sessionData.expiresAt,
        createdAt: sessionData.createdAt,
      };
    } else {
      // Clear invalid session cookie
      res.clearCookie('session_token');
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Don't fail the request for optional auth
    next();
  }
};

/**
 * Middleware to require specific authentication method
 */
export const requireAuthMethod = (method: 'password' | 'webauthn') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    if (req.user.authMethod !== method) {
      return res.status(403).json({
        success: false,
        error: `This endpoint requires ${method} authentication`,
        code: 'AUTH_METHOD_REQUIRED',
      });
    }

    next();
  };
};

/**
 * Middleware to check if user's email is verified (for password auth)
 */
export const requireEmailVerified = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // Only check email verification for password auth
    if (req.user.authMethod === 'password') {
      // This would need to be implemented to check email verification status
      // For now, we'll assume it's handled in the authentication flow
    }

    next();
  } catch (error) {
    console.error('Email verification middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Middleware to log authentication events
 */
export const logAuthEvent = (event: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id || 'anonymous';
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    console.log(`Auth Event: ${event}`, {
      userId,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    });

    next();
  };
};

/**
 * Middleware to validate session and extend expiry if needed
 */
export const extendSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session) {
      return next();
    }

    const sessionService = await Effect.runPromise(SessionService);
    const sessionToken = req.cookies.session_token || 
                        req.headers.authorization?.replace('Bearer ', '');

    if (sessionToken) {
      // Extend session if it's close to expiry (within 2 hours)
      const expiresAt = new Date(req.session.expiresAt);
      const now = new Date();
      const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilExpiry < 2) {
        await Effect.runPromise(sessionService.extendSession(sessionToken));
      }
    }

    next();
  } catch (error) {
    console.error('Session extension error:', error);
    // Don't fail the request if session extension fails
    next();
  }
};

/**
 * Middleware to check rate limits for authenticated users
 */
export const authenticatedRateLimit = (maxRequests: number, windowMs: number) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
      });
    }

    userLimit.count++;
    next();
  };
};

