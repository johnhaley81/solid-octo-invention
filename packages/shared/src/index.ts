// Shared types, schemas, and utilities
export * from './types/index.js';
export * from './schemas/index.js';
export * from './errors/index.js';

// Authentication exports (with namespace to avoid conflicts)
export * as AuthTypes from './types/auth.js';
export * as AuthSchemas from './schemas/auth.js';
export * as AuthErrors from './errors/auth.js';
