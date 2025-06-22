const Joi = require('joi');

/**
 * Validation middleware factory
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }

    // Replace the original data with validated data
    req[property] = value;
    next();
  };
};

// Common validation schemas
const schemas = {
  // Email validation
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),

  // Password validation
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required',
    }),

  // OTP validation
  otp: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'any.required': 'OTP is required',
    }),

  // Token validation
  token: Joi.string()
    .min(32)
    .max(128)
    .alphanum()
    .required()
    .messages({
      'string.min': 'Invalid token format',
      'string.max': 'Invalid token format',
      'string.alphanum': 'Invalid token format',
      'any.required': 'Token is required',
    }),

  // UUID validation
  uuid: Joi.string()
    .uuid({ version: 'uuidv4' })
    .required()
    .messages({
      'string.uuid': 'Invalid ID format',
      'any.required': 'ID is required',
    }),
};

// Specific validation schemas for different endpoints
const validationSchemas = {
  // Registration
  register: Joi.object({
    email: schemas.email,
    password: schemas.password,
  }),

  // Login
  login: Joi.object({
    email: schemas.email,
    password: schemas.password,
    otp: Joi.string().length(6).pattern(/^\d{6}$/).optional(),
  }),

  // OTP verification
  verifyOTP: Joi.object({
    email: schemas.email,
    otp: schemas.otp,
  }),

  // Email verification
  verifyEmail: Joi.object({
    token: schemas.token,
  }),

  // Password reset request
  passwordResetRequest: Joi.object({
    email: schemas.email,
  }),

  // Password reset completion
  passwordResetComplete: Joi.object({
    token: schemas.token,
    password: schemas.password,
  }),

  // Change password
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: schemas.password,
  }),

  // Switch to password auth
  switchToPassword: Joi.object({
    password: schemas.password,
  }),

  // WebAuthn registration begin
  webauthnRegisterBegin: Joi.object({
    email: schemas.email,
  }),

  // WebAuthn registration complete
  webauthnRegisterComplete: Joi.object({
    userId: schemas.uuid,
    registrationResponse: Joi.object().required(),
  }),

  // WebAuthn authentication begin
  webauthnAuthBegin: Joi.object({
    email: schemas.email,
  }),

  // WebAuthn authentication complete
  webauthnAuthComplete: Joi.object({
    userId: schemas.uuid,
    authenticationResponse: Joi.object().required(),
  }),

  // Delete WebAuthn credential
  deleteWebAuthnCredential: Joi.object({
    credentialId: Joi.string().required(),
  }),
};

// Export validation middleware for each schema
const validators = {};
Object.keys(validationSchemas).forEach(key => {
  validators[key] = validate(validationSchemas[key]);
});

module.exports = {
  validate,
  schemas,
  validationSchemas,
  validators,
};

