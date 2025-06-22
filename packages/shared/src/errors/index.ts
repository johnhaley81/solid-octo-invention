import { Data } from 'effect';

/**
 * Base domain error
 */
export abstract class DomainError extends Data.TaggedError('DomainError') {
  abstract override readonly message: string;
}

/**
 * Not found errors
 */
export class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  readonly userId: string;
}> {
  override get message() {
    return `User with ID ${this.userId} not found`;
  }
}

export class PostNotFoundError extends Data.TaggedError('PostNotFoundError')<{
  readonly postId: string;
}> {
  override get message() {
    return `Post with ID ${this.postId} not found`;
  }
}

export class CommentNotFoundError extends Data.TaggedError('CommentNotFoundError')<{
  readonly commentId: string;
}> {
  override get message() {
    return `Comment with ID ${this.commentId} not found`;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly field: string;
  readonly reason: string;
}> {
  override get message() {
    return `Validation failed for field '${this.field}': ${this.reason}`;
  }
}

export class SchemaValidationError extends Data.TaggedError('SchemaValidationError')<{
  readonly errors: readonly string[];
}> {
  override get message() {
    return `Schema validation failed: ${this.errors.join(', ')}`;
  }
}

/**
 * Business logic errors
 */
export class ConflictError extends Data.TaggedError('ConflictError')<{
  readonly resource: string;
  readonly reason: string;
}> {
  override get message() {
    return `Conflict with ${this.resource}: ${this.reason}`;
  }
}

export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  readonly action: string;
  readonly resource?: string;
}> {
  override get message() {
    return this.resource
      ? `Unauthorized to ${this.action} ${this.resource}`
      : `Unauthorized to ${this.action}`;
  }
}

export class ForbiddenError extends Data.TaggedError('ForbiddenError')<{
  readonly action: string;
  readonly resource?: string;
}> {
  override get message() {
    return this.resource
      ? `Forbidden to ${this.action} ${this.resource}`
      : `Forbidden to ${this.action}`;
  }
}

/**
 * Infrastructure errors
 */
export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly operation: string;
  readonly cause?: unknown;
}> {
  override get message() {
    return `Database error during ${this.operation}`;
  }
}

export class ExternalServiceError extends Data.TaggedError('ExternalServiceError')<{
  readonly service: string;
  readonly operation: string;
  readonly cause?: unknown;
}> {
  override get message() {
    return `External service error: ${this.service} failed during ${this.operation}`;
  }
}

/**
 * Post-specific business errors
 */
export class PostAlreadyPublishedError extends Data.TaggedError('PostAlreadyPublishedError')<{
  readonly postId: string;
}> {
  override get message() {
    return `Post ${this.postId} is already published`;
  }
}

export class PostNotPublishedError extends Data.TaggedError('PostNotPublishedError')<{
  readonly postId: string;
}> {
  override get message() {
    return `Post ${this.postId} is not published`;
  }
}

export class SlugAlreadyExistsError extends Data.TaggedError('SlugAlreadyExistsError')<{
  readonly slug: string;
}> {
  override get message() {
    return `Post with slug '${this.slug}' already exists`;
  }
}

/**
 * Comment-specific business errors
 */
export class CommentOnArchivedPostError extends Data.TaggedError('CommentOnArchivedPostError')<{
  readonly postId: string;
}> {
  override get message() {
    return `Cannot comment on archived post ${this.postId}`;
  }
}

export class InvalidParentCommentError extends Data.TaggedError('InvalidParentCommentError')<{
  readonly parentId: string;
  readonly postId: string;
}> {
  override get message() {
    return `Parent comment ${this.parentId} does not belong to post ${this.postId}`;
  }
}

/**
 * Error utility functions
 */
export const ErrorUtils = {
  /**
   * Check if an error is a domain error
   */
  isDomainError: (error: unknown): error is DomainError => {
    return error instanceof DomainError;
  },

  /**
   * Check if an error is a not found error
   */
  isNotFoundError: (
    error: unknown,
  ): error is UserNotFoundError | PostNotFoundError | CommentNotFoundError => {
    return (
      error instanceof UserNotFoundError ||
      error instanceof PostNotFoundError ||
      error instanceof CommentNotFoundError
    );
  },

  /**
   * Check if an error is a validation error
   */
  isValidationError: (error: unknown): error is ValidationError | SchemaValidationError => {
    return error instanceof ValidationError || error instanceof SchemaValidationError;
  },

  /**
   * Check if an error is an authorization error
   */
  isAuthorizationError: (error: unknown): error is UnauthorizedError | ForbiddenError => {
    return error instanceof UnauthorizedError || error instanceof ForbiddenError;
  },

  /**
   * Convert an unknown error to a domain error
   */
  toDomainError: (error: unknown, context: string): DomainError | ExternalServiceError => {
    if (ErrorUtils.isDomainError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new ExternalServiceError({
        service: 'unknown',
        operation: context,
        cause: error,
      });
    }

    return new ExternalServiceError({
      service: 'unknown',
      operation: context,
      cause: error,
    });
  },
};

// Re-export authentication errors
export * from './auth.js';
