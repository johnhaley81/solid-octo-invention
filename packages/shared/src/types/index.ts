/**
 * Common utility types used across the application
 */

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Make specific properties of T optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * Make specific properties of T required
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>

/**
 * Extract the type of array elements
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never

/**
 * Create a type that excludes null and undefined
 */
export type NonNullable<T> = T extends null | undefined ? never : T

/**
 * Create a branded type for better type safety
 */
export type Brand<T, B> = T & { readonly __brand: B }

/**
 * Common HTTP status codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const

export type HttpStatusCode = typeof HttpStatus[keyof typeof HttpStatus]

/**
 * API response wrapper types
 */
export interface ApiResponse<T = unknown> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
  readonly timestamp: string
}

export interface ApiError {
  readonly code: string
  readonly message: string
  readonly details?: Record<string, unknown>
}

/**
 * Pagination types
 */
export interface PaginationParams {
  readonly limit: number
  readonly offset: number
}

export interface PaginationMeta {
  readonly totalCount: number
  readonly hasNextPage: boolean
  readonly hasPreviousPage: boolean
  readonly currentPage: number
  readonly totalPages: number
}

export interface PaginatedResponse<T> {
  readonly items: readonly T[]
  readonly pagination: PaginationMeta
}

/**
 * Sort order types
 */
export type SortOrder = 'asc' | 'desc'

export interface SortParams<T extends string = string> {
  readonly field: T
  readonly order: SortOrder
}

/**
 * Filter types for common operations
 */
export interface DateRangeFilter {
  readonly from?: Date
  readonly to?: Date
}

export interface TextFilter {
  readonly contains?: string
  readonly startsWith?: string
  readonly endsWith?: string
  readonly equals?: string
}

/**
 * Environment types
 */
export type Environment = 'development' | 'test' | 'staging' | 'production'

/**
 * Log level types
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Configuration types
 */
export interface DatabaseConfig {
  readonly url: string
  readonly ssl: boolean
  readonly maxConnections: number
  readonly connectionTimeout: number
}

export interface ServerConfig {
  readonly port: number
  readonly host: string
  readonly environment: Environment
  readonly corsOrigin: string
}

export interface RedisConfig {
  readonly url: string
  readonly keyPrefix: string
  readonly ttl: number
}

/**
 * Utility type for creating immutable objects
 */
export type Immutable<T> = {
  readonly [P in keyof T]: T[P] extends object ? Immutable<T[P]> : T[P]
}

/**
 * Utility type for function parameters
 */
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never

/**
 * Utility type for function return type
 */
export type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any

/**
 * Utility type for promise resolution type
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T

/**
 * Common event types for domain events
 */
export interface DomainEvent<T = unknown> {
  readonly id: string
  readonly type: string
  readonly aggregateId: string
  readonly aggregateType: string
  readonly data: T
  readonly version: number
  readonly occurredAt: Date
}

/**
 * Command and Query types for CQRS pattern
 */
export interface Command<T = unknown> {
  readonly type: string
  readonly payload: T
  readonly metadata?: Record<string, unknown>
}

export interface Query<T = unknown> {
  readonly type: string
  readonly params: T
  readonly metadata?: Record<string, unknown>
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E }

/**
 * Option type for values that may not exist
 */
export type Option<T> = T | null | undefined

/**
 * Either type for representing two possible values
 */
export type Either<L, R> = 
  | { readonly _tag: 'Left'; readonly left: L }
  | { readonly _tag: 'Right'; readonly right: R }

