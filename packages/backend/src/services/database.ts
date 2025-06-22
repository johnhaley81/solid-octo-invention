import { Effect as E, Layer, Context } from 'effect'
import { Pool, PoolClient } from 'pg'
import { envVars } from '../config/index.js'

/**
 * Database service interface
 */
export interface DatabaseService {
  readonly query: <T = any>(text: string, params?: any[]) => E.Effect<T[], DatabaseError>
  readonly getClient: () => E.Effect<PoolClient, DatabaseError>
  readonly transaction: <T>(fn: (client: PoolClient) => E.Effect<T, DatabaseError>) => E.Effect<T, DatabaseError>
  readonly close: () => E.Effect<void, never>
}

/**
 * Database error types
 */
export class DatabaseError extends Error {
  readonly _tag = 'DatabaseError'
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
  }
}

/**
 * Database service tag for dependency injection
 */
export const DatabaseService = Context.GenericTag<DatabaseService>('DatabaseService')

/**
 * Create database service implementation
 */
const makeDatabaseService = E.gen(function* () {
  const databaseUrl = yield* envVars.DATABASE_URL
  
  yield* E.logInfo('Initializing database connection pool')
  
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })
  
  // Test the connection
  yield* E.tryPromise({
    try: () => pool.query('SELECT NOW()'),
    catch: (error) => new DatabaseError('Failed to connect to database', error)
  })
  
  yield* E.logInfo('Database connection pool initialized successfully')
  
  const query = <T = any>(text: string, params?: any[]) =>
    E.tryPromise({
      try: async () => {
        const result = await pool.query(text, params)
        return result.rows as T[]
      },
      catch: (error) => new DatabaseError(`Query failed: ${text}`, error)
    }).pipe(
      E.tapError((error) => E.logError('Database query failed', { text, params, error })),
      E.withSpan('database-query', { attributes: { query: text } })
    )
  
  const getClient = () =>
    E.tryPromise({
      try: () => pool.connect(),
      catch: (error) => new DatabaseError('Failed to get database client', error)
    })
  
  const transaction = <T>(fn: (client: PoolClient) => E.Effect<T, DatabaseError>) =>
    E.gen(function* () {
      const client = yield* getClient()
      
      try {
        yield* E.tryPromise({
          try: () => client.query('BEGIN'),
          catch: (error) => new DatabaseError('Failed to begin transaction', error)
        })
        
        const result = yield* fn(client)
        
        yield* E.tryPromise({
          try: () => client.query('COMMIT'),
          catch: (error) => new DatabaseError('Failed to commit transaction', error)
        })
        
        return result
      } catch (error) {
        yield* E.tryPromise({
          try: () => client.query('ROLLBACK'),
          catch: (rollbackError) => new DatabaseError('Failed to rollback transaction', rollbackError)
        }).pipe(E.ignore)
        
        yield* E.fail(error instanceof DatabaseError ? error : new DatabaseError('Transaction failed', error))
      } finally {
        client.release()
      }
    }).pipe(
      E.withSpan('database-transaction')
    )
  
  const close = () =>
    E.tryPromise({
      try: async () => {
        yield* E.logInfo('Closing database connection pool')
        await pool.end()
        yield* E.logInfo('Database connection pool closed')
      },
      catch: (error) => {
        yield* E.logError('Failed to close database connection pool', { error })
      }
    }).pipe(E.ignore)
  
  return {
    query,
    getClient,
    transaction,
    close,
  } satisfies DatabaseService
})

/**
 * Database service layer
 */
export const DatabaseServiceLive = Layer.effect(DatabaseService, makeDatabaseService)

/**
 * Default database service layer
 */
DatabaseService.Default = DatabaseServiceLive

/**
 * Test database service for testing
 */
export const TestDatabaseService = Layer.succeed(DatabaseService, {
  query: <T = any>(_text: string, _params?: any[]) => E.succeed([] as T[]),
  getClient: () => E.die('TestDatabaseService.getClient not implemented'),
  transaction: <T>(_fn: (client: PoolClient) => E.Effect<T, DatabaseError>) => E.die('TestDatabaseService.transaction not implemented'),
  close: () => E.succeed(undefined),
} satisfies DatabaseService)

