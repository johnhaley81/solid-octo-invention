import { Schema as S } from '@effect/schema';

/**
 * Branded types for domain identifiers
 */
export const UserId = S.String.pipe(S.brand('UserId'));
export type UserId = S.Schema.Type<typeof UserId>;

/**
 * User schema
 */
export const User = S.Struct({
  id: UserId,
  email: S.String.pipe(S.minLength(1), S.maxLength(255)),
  name: S.String.pipe(S.minLength(1), S.maxLength(100)),
  avatarUrl: S.optional(S.String),
  authMethod: S.Literal('password', 'webauthn'),
  createdAt: S.Date,
  updatedAt: S.Date,
});
export type User = S.Schema.Type<typeof User>;

/**
 * Input schemas for operations
 */
export const CreateUserInput = S.Struct({
  email: S.String.pipe(S.minLength(1), S.maxLength(255)),
  name: S.String.pipe(S.minLength(1), S.maxLength(100)),
  avatarUrl: S.optional(S.String),
});
export type CreateUserInput = S.Schema.Type<typeof CreateUserInput>;

/**
 * Pagination schemas
 */
export const PaginationInput = S.Struct({
  limit: S.Number.pipe(S.int(), S.greaterThan(0), S.lessThanOrEqualTo(100)),
  offset: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0)),
});
export type PaginationInput = S.Schema.Type<typeof PaginationInput>;

export const PaginatedResult = <T>(itemSchema: S.Schema<T>) =>
  S.Struct({
    items: S.Array(itemSchema),
    totalCount: S.Number.pipe(S.int(), S.greaterThanOrEqualTo(0)),
    hasNextPage: S.Boolean,
    hasPreviousPage: S.Boolean,
  });

export type PaginatedResult<T> = {
  items: T[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/**
 * Utility functions for schema operations
 */
export const SchemaUtils = {
  /**
   * Create a new user ID
   */
  createUserId: (id: string): UserId => S.decodeSync(UserId)(id),
};

// Authentication schemas are exported separately to avoid conflicts
