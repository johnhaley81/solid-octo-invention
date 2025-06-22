import { Config, ConfigProvider, Layer } from 'effect'

/**
 * Environment variables configuration using Effect Config system
 * All environment variables should be defined here and accessed through Effect
 */
export const envVars = {
  // Database configuration
  DATABASE_URL: Config.redacted('DATABASE_URL'),

  // Server configuration
  PORT: Config.integer('PORT').pipe(Config.withDefault(3000)),
  NODE_ENV: Config.string('NODE_ENV').pipe(Config.withDefault('development')),

  // GraphQL configuration
  GRAPHQL_ENDPOINT: Config.string('GRAPHQL_ENDPOINT').pipe(Config.withDefault('/graphql')),
  ENABLE_GRAPHIQL: Config.boolean('ENABLE_GRAPHIQL').pipe(Config.withDefault(true)),

  // Worker configuration
  WORKER_CONCURRENCY: Config.integer('WORKER_CONCURRENCY').pipe(Config.withDefault(5)),

  // Redis configuration (for caching and sessions)
  REDIS_URL: Config.string('REDIS_URL').pipe(Config.withDefault('redis://localhost:6379')),

  // Security configuration
  JWT_SECRET: Config.redacted('JWT_SECRET'),
  CORS_ORIGIN: Config.string('CORS_ORIGIN').pipe(Config.withDefault('http://localhost:5173')),
} as const

/**
 * Mock configuration provider for testing
 */
const mockConfigProvider = ConfigProvider.fromJson({
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/solid_octo_invention_test',
  PORT: 3001,
  NODE_ENV: 'test',
  GRAPHQL_ENDPOINT: '/graphql',
  ENABLE_GRAPHIQL: false,
  WORKER_CONCURRENCY: 1,
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'test-jwt-secret-key',
  CORS_ORIGIN: 'http://localhost:3000',
})

/**
 * Test configuration layer for use in tests
 */
export const MockConfigLayer = Layer.setConfigProvider(mockConfigProvider)

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  readonly url: string;
  readonly ssl: boolean;
  readonly maxConnections: number;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly corsOrigin: string;
  readonly enableGraphiQL: boolean;
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  readonly concurrency: number;
  readonly redisUrl: string;
}
