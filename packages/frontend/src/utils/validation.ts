/**
 * Shared validation schemas and utilities
 * Ensures consistent validation across frontend and backend
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Email validation schema
 */
export const emailSchema = {
  required: true,
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  messages: {
    required: 'Email is required',
    pattern: 'Please enter a valid email address',
  },
};

/**
 * Password validation schema
 */
export const passwordSchema = {
  required: true,
  minLength: 8,
  messages: {
    required: 'Password is required',
    minLength: 'Password must be at least 8 characters',
  },
};

/**
 * Name validation schema
 */
export const nameSchema = {
  required: true,
  minLength: 2,
  maxLength: 50,
  messages: {
    required: 'Name is required',
    minLength: 'Name must be at least 2 characters',
    maxLength: 'Name must be less than 50 characters',
  },
};

/**
 * Validate a single field against its schema
 */
export function validateField(value: string, schema: any): string | null {
  if (schema.required && !value.trim()) {
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
 * Validate login form data
 */
export function validateLoginForm(email: string, password: string): ValidationResult {
  const errors: Record<string, string> = {};

  const emailError = validateField(email, emailSchema);
  if (emailError) errors.email = emailError;

  const passwordError = validateField(password, passwordSchema);
  if (passwordError) errors.password = passwordError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate registration form data
 */
export function validateRegistrationForm(
  email: string,
  name: string,
  password: string,
  confirmPassword: string,
): ValidationResult {
  const errors: Record<string, string> = {};

  const emailError = validateField(email, emailSchema);
  if (emailError) errors.email = emailError;

  const nameError = validateField(name, nameSchema);
  if (nameError) errors.name = nameError;

  const passwordError = validateField(password, passwordSchema);
  if (passwordError) errors.password = passwordError;

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
