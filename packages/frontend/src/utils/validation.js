/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password validation regex - at least 8 characters with uppercase, lowercase, and number
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;

/**
 * Validate email format
 */
export function validateEmail(email) {
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
export function validatePassword(password) {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long' };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return {
      isValid: false,
      error:
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    };
  }

  return { isValid: true, error: null };
}

/**
 * Validate name field
 */
export function validateName(name) {
  if (!name) {
    return { isValid: false, error: 'Name is required' };
  }

  if (name.trim().length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters long' };
  }

  return { isValid: true, error: null };
}

/**
 * Validate login form
 */
export function validateLoginForm(email, password) {
  const errors = {};
  let isValid = true;

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error;
    isValid = false;
  }

  if (!password) {
    errors.password = 'Password is required';
    isValid = false;
  }

  return { isValid, errors };
}

/**
 * Validate registration form
 */
export function validateRegistrationForm(email, name, password, confirmPassword) {
  const errors = {};
  let isValid = true;

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error;
    isValid = false;
  }

  const nameValidation = validateName(name);
  if (!nameValidation.isValid) {
    errors.name = nameValidation.error;
    isValid = false;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.error;
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
export function validatePasswordResetForm(email) {
  const errors = {};
  let isValid = true;

  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error;
    isValid = false;
  }

  return { isValid, errors };
}

/**
 * Validate new password form
 */
export function validateNewPasswordForm(password, confirmPassword) {
  const errors = {};
  let isValid = true;

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.error;
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
