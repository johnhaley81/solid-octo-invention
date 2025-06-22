/**
 * Session management service using Effect-TS
 * Handles user session creation, validation, and cleanup
 */

import { Effect, Layer, Context } from 'effect';
import { randomBytes } from 'crypto';
import {
  createSessionExpiredError,
  createSessionInvalidError,
  type AuthError,
} from '@solid-octo-invention/shared';
import { DatabaseService } from '../database.js';

export interface SessionService {
  readonly createSession: (
    userId: string,
    authMethod: 'password' | 'webauthn',
    ipAddress?: string,
    userAgent?: string,
  ) => Effect.Effect<string, AuthError>;

  readonly validateSession: (sessionToken: string) => Effect.Effect<any | null, AuthError>;

  readonly getUserBySession: (sessionToken: string) => Effect.Effect<any | null, AuthError>;

  readonly deleteSession: (sessionToken: string) => Effect.Effect<{ message: string }, AuthError>;

  readonly deleteUserSessions: (userId: string) => Effect.Effect<{ message: string }, AuthError>;

  readonly cleanupExpiredSessions: () => Effect.Effect<void, AuthError>;

  readonly getUserSessions: (userId: string) => Effect.Effect<any[], AuthError>;
}

export const SessionService = Context.GenericTag<SessionService>('SessionService');

const SESSION_DURATION_HOURS = 24; // 24 hours
const MAX_SESSIONS_PER_USER = 5; // Limit concurrent sessions

const make = Effect.gen(function* () {
  const db = yield* DatabaseService;

  const generateSessionToken = () =>
    Effect.sync(() => {
      return randomBytes(32).toString('hex');
    });

  const createSession = (
    userId: string,
    authMethod: 'password' | 'webauthn',
    ipAddress?: string,
    userAgent?: string,
  ) =>
    Effect.gen(function* () {
      const sessionToken = yield* generateSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

      // Clean up old sessions if user has too many
      const existingSessionsResult = yield* db.query(
        'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1',
        [userId],
      );

      const sessionCount = parseInt(existingSessionsResult.rows[0].count);
      if (sessionCount >= MAX_SESSIONS_PER_USER) {
        // Delete oldest sessions
        yield* db.query(
          `DELETE FROM user_sessions 
           WHERE user_id = $1 
           AND id IN (
             SELECT id FROM user_sessions 
             WHERE user_id = $1 
             ORDER BY created_at ASC 
             LIMIT $2
           )`,
          [userId, sessionCount - MAX_SESSIONS_PER_USER + 1],
        );
      }

      // Create new session
      yield* db.query(
        `INSERT INTO user_sessions (user_id, session_token, auth_method, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, sessionToken, authMethod, ipAddress, userAgent, expiresAt],
      );

      return sessionToken;
    });

  const validateSession = (sessionToken: string) =>
    Effect.gen(function* () {
      const sessionResult = yield* db.query(
        `SELECT us.*, u.id as user_id, u.email, u.name, u.auth_method, u.created_at as user_created_at, u.updated_at as user_updated_at
         FROM user_sessions us
         JOIN users u ON us.user_id = u.id
         WHERE us.session_token = $1`,
        [sessionToken],
      );

      if (sessionResult.rows.length === 0) {
        return null;
      }

      const session = sessionResult.rows[0];

      // Check if session is expired
      if (new Date(session.expires_at) < new Date()) {
        // Clean up expired session
        yield* db.query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
        return null;
      }

      return {
        sessionId: session.id,
        userId: session.user_id,
        authMethod: session.auth_method,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        expiresAt: session.expires_at,
        createdAt: session.created_at,
        user: {
          id: session.user_id,
          email: session.email,
          name: session.name,
          authMethod: session.auth_method,
          createdAt: session.user_created_at,
          updatedAt: session.user_updated_at,
        },
      };
    });

  const getUserBySession = (sessionToken: string) =>
    Effect.gen(function* () {
      const session = yield* validateSession(sessionToken);
      return session ? session.user : null;
    });

  const deleteSession = (sessionToken: string) =>
    Effect.gen(function* () {
      const result = yield* db.query(
        'DELETE FROM user_sessions WHERE session_token = $1',
        [sessionToken],
      );

      if (result.rowCount === 0) {
        return yield* Effect.fail(createSessionInvalidError('Session not found'));
      }

      return { message: 'Session deleted successfully' };
    });

  const deleteUserSessions = (userId: string) =>
    Effect.gen(function* () {
      yield* db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
      return { message: 'All user sessions deleted successfully' };
    });

  const cleanupExpiredSessions = () =>
    Effect.gen(function* () {
      yield* db.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
    });

  const getUserSessions = (userId: string) =>
    Effect.gen(function* () {
      const sessionsResult = yield* db.query(
        `SELECT id, auth_method, ip_address, user_agent, expires_at, created_at
         FROM user_sessions 
         WHERE user_id = $1 AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [userId],
      );

      return sessionsResult.rows.map((session) => ({
        id: session.id,
        authMethod: session.auth_method,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        expiresAt: session.expires_at,
        createdAt: session.created_at,
        isCurrentSession: false, // This would need to be determined by comparing with current session
      }));
    });

  const extendSession = (sessionToken: string) =>
    Effect.gen(function* () {
      const newExpiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
      
      const result = yield* db.query(
        'UPDATE user_sessions SET expires_at = $1 WHERE session_token = $2 AND expires_at > NOW()',
        [newExpiresAt, sessionToken],
      );

      if (result.rowCount === 0) {
        return yield* Effect.fail(createSessionExpiredError('Session not found or expired'));
      }

      return { expiresAt: newExpiresAt };
    });

  const getSessionInfo = (sessionToken: string) =>
    Effect.gen(function* () {
      const sessionResult = yield* db.query(
        `SELECT us.*, u.email, u.name
         FROM user_sessions us
         JOIN users u ON us.user_id = u.id
         WHERE us.session_token = $1 AND us.expires_at > NOW()`,
        [sessionToken],
      );

      if (sessionResult.rows.length === 0) {
        return null;
      }

      const session = sessionResult.rows[0];
      return {
        id: session.id,
        userId: session.user_id,
        authMethod: session.auth_method,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        expiresAt: session.expires_at,
        createdAt: session.created_at,
        userEmail: session.email,
        userName: session.name,
      };
    });

  return {
    createSession,
    validateSession,
    getUserBySession,
    deleteSession,
    deleteUserSessions,
    cleanupExpiredSessions,
    getUserSessions,
    extendSession,
    getSessionInfo,
  } as const;
});

export const SessionServiceLive = Layer.effect(SessionService, make).pipe(
  Layer.provide(DatabaseService.Default),
);

