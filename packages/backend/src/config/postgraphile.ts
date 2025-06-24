/**
 * Shared PostGraphile Configuration
 * 
 * This module provides a centralized configuration for PostGraphile that can be used
 * across different contexts (server, schema generation, etc.) while allowing for
 * environment-specific overrides.
 */

import * as PgOmitArchivedModule from '@graphile-contrib/pg-omit-archived';
const PgOmitArchivedPlugin =
  (PgOmitArchivedModule.default as any).default || PgOmitArchivedModule.default;
import type { PostGraphileOptions } from 'postgraphile';

export interface PostGraphileConfigOptions {
  /** Environment (development, test, production) */
  nodeEnv?: string;
  /** Whether to enable GraphiQL interface */
  enableGraphiQL?: boolean;
  /** Path to export GraphQL schema file */
  exportGqlSchemaPath?: string;
  /** Whether to watch for database changes */
  watchPg?: boolean;
  /** Whether to enable subscriptions */
  subscriptions?: boolean;
  /** Additional options to override defaults */
  overrides?: Partial<PostGraphileOptions>;
}

/**
 * Creates PostGraphile configuration with sensible defaults and environment-specific settings
 */
export function createPostGraphileConfig(options: PostGraphileConfigOptions = {}): PostGraphileOptions {
  const {
    nodeEnv = process.env.NODE_ENV || 'development',
    enableGraphiQL = false,
    exportGqlSchemaPath,
    watchPg,
    subscriptions = false,
    overrides = {},
  } = options;

  const isDevelopment = nodeEnv === 'development';
  const isTest = nodeEnv === 'test';
  const isCI = process.env.CI === 'true';

  const baseConfig: PostGraphileOptions = {
    // Performance and behavior
    watchPg: watchPg ?? isDevelopment,
    dynamicJson: true,
    setofFunctionsContainNulls: false,
    ignoreRBAC: false,
    legacyRelations: 'omit',
    sortExport: true,

    // GraphiQL interface
    graphiql: enableGraphiQL,
    enhanceGraphiql: enableGraphiQL,

    // Subscriptions
    subscriptions,

    // Error handling and debugging
    showErrorStack: isDevelopment ? 'json' : false,
    extendedErrors: isDevelopment ? ['hint', 'detail', 'errcode'] : ['errcode'],

    // Plugins
    appendPlugins: [
      // Soft delete support - automatically omits records where deleted_at IS NOT NULL
      PgOmitArchivedPlugin,
    ],

    // Plugin configuration
    graphileBuildOptions: {
      // Configure pg-omit-archived plugin to use deleted_at column
      pgArchivedColumnName: 'deleted_at',
      pgArchivedColumnImpliesVisible: false, // deleted_at IS NOT NULL means hidden
      pgArchivedRelations: true, // Also apply to related records
      pgArchivedDefault: 'NO', // Exclude soft-deleted records by default
    },

    // PostgreSQL settings
    pgSettings: _req => ({
      // Set PostgreSQL settings based on request context
      role: 'postgres', // This will be enhanced with proper authentication
    }),

    // Schema export (for development, test, and CI environments)
    ...((isDevelopment || isTest || isCI) && exportGqlSchemaPath && { 
      exportGqlSchemaPath,
    }),
  };

  // Apply any overrides
  return {
    ...baseConfig,
    ...overrides,
  };
}

/**
 * Default configuration for the main server
 */
export function createServerPostGraphileConfig(options: {
  nodeEnv: string;
  enableGraphiQL: boolean;
}): PostGraphileOptions {
  return createPostGraphileConfig({
    nodeEnv: options.nodeEnv,
    enableGraphiQL: options.enableGraphiQL,
    exportGqlSchemaPath: 'schema.graphql',
    subscriptions: false,
  });
}

/**
 * Configuration for schema generation (CI/testing)
 */
export function createSchemaGenerationConfig(options: {
  exportPath: string;
  databaseUrl?: string;
}): PostGraphileOptions {
  return createPostGraphileConfig({
    nodeEnv: 'test',
    enableGraphiQL: false,
    exportGqlSchemaPath: options.exportPath,
    watchPg: false,
    subscriptions: false,
    overrides: {
      // Override for schema generation - we don't need these features
      enhanceGraphiql: false,
    },
  });
}
