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
 * Authentication-specific errors
 */
export class InvalidCredentialsError extends Data.TaggedError('InvalidCredentialsError')<{
  readonly message: string;
}> {
  override get message(): string {
    return this.message;
  }
}

export class SessionExpiredError extends Data.TaggedError('SessionExpiredError')<{
  readonly sessionId: string;
}> {
  override get message() {
    return `Session ${this.sessionId} has expired`;
  }
}

export class EmailAlreadyExistsError extends Data.TaggedError('EmailAlreadyExistsError')<{
  readonly email: string;
}> {
  override get message() {
    return `User with email '${this.email}' already exists`;
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
  isNotFoundError: (error: unknown): error is UserNotFoundError => {
    return error instanceof UserNotFoundError;
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
   * Check if an error is an authentication error
   */
  isAuthenticationError: (
    error: unknown,
  ): error is InvalidCredentialsError | SessionExpiredError | EmailAlreadyExistsError => {
    return (
      error instanceof InvalidCredentialsError ||
      error instanceof SessionExpiredError ||
      error instanceof EmailAlreadyExistsError
    );
  },

  /**
   * Convert an unknown error to a domain error
   */
  toDomainError: (error: unknown): ValidationError => {
    if (error instanceof Error) {
      return new ValidationError({ field: 'unknown', reason: error.message });
    }

    return new ValidationError({ field: 'unknown', reason: 'An unknown error occurred' });
  },

  /**
   * Extract error message from any error type
   */
  getErrorMessage: (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'An unknown error occurred';
  },
};

// Authentication errors are exported separately to avoid conflicts
