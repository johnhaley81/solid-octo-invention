/**
 * Shared validation schemas and utilities
 * Single source of truth for validation across frontend and backend
 * Consistent with backend Effect-TS schemas in packages/shared/src/schemas/auth.ts
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface SingleFieldValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Email validation regex - matches backend schema
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password validation regex - matches backend schema requirements
 * At least 8 characters with uppercase, lowercase, number, and special character
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/;

/**
 * Email validation schema
 */
export const emailSchema = {
  required: true,
  pattern: EMAIL_REGEX,
  messages: {
    required: 'Email is required',
    pattern: 'Please enter a valid email address',
  },
};

/**
 * Password validation schema - matches backend requirements
 */
export const passwordSchema = {
  required: true,
  minLength: 8,
  pattern: PASSWORD_REGEX,
  messages: {
    required: 'Password is required',
    minLength: 'Password must be at least 8 characters',
    pattern:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  },
};

/**
 * Name validation schema - matches backend schema (1-255 characters)
 */
export const nameSchema = {
  required: true,
  minLength: 1,
  maxLength: 255,
  messages: {
    required: 'Name is required',
    minLength: 'Name must be at least 1 character',
    maxLength: 'Name must be less than 255 characters',
  },
};

/**
 * Validate email format
 */
export function validateEmail(email: string): SingleFieldValidationResult {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true, error: null };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): SingleFieldValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return {
      isValid: false,
      error:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate name field
 */
export function validateName(name: string): SingleFieldValidationResult {
  if (!name) {
    return { isValid: false, error: 'Name is required' };
  }

  if (name.trim().length < 1) {
    return { isValid: false, error: 'Name is required' };
  }

  if (name.length > 255) {
    return { isValid: false, error: 'Name must be less than 255 characters' };
  }

  return { isValid: true, error: null };
}

/**
 * Validate a single field against its schema
 */
export function validateField(value: string, schema: any): string | null {
  if (schema.required && !value?.trim()) {
    return schema.messages.required;
  }

  if (value && schema.pattern && !schema.pattern.test(value)) {
    return schema.messages.pattern;
  }

  if (value && schema.minLength && value.length < schema.minLength) {
    return schema.messages.minLength;
  }

  if (value && schema.maxLength && value.length > schema.maxLength) {
    return schema.messages.maxLength;
  }

  return null;
}

/**
 * Validate login form
 */
export function validateLoginForm(email: string, password: string): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error!;
    isValid = false;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.error!;
    isValid = false;
  }

  return { isValid, errors };
}

/**
 * Validate registration form
 */
export function validateRegistrationForm(
  email: string,
  name: string,
  password: string,
  confirmPassword: string,
): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error!;
    isValid = false;
  }

  const nameValidation = validateName(name);
  if (!nameValidation.isValid) {
    errors.name = nameValidation.error!;
    isValid = false;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.error!;
    isValid = false;
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
    isValid = false;
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
    isValid = false;
  }

  return { isValid, errors };
}

/**
 * Validate password reset form
 */
export function validatePasswordResetForm(email: string): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error!;
    isValid = false;
  }

  return { isValid, errors };
}

/**
 * Validate new password form
 */
export function validateNewPasswordForm(
  password: string,
  confirmPassword: string,
): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.error!;
    isValid = false;
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
    isValid = false;
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
    isValid = false;
  }

  return { isValid, errors };
}
