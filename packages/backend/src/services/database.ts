import { Effect as E, Layer, Context, Redacted } from 'effect';
import { Pool, type PoolClient } from 'pg';
import { envVars } from '../config/index.js';

/**
 * Database service interface
 */
export interface DatabaseService {
  readonly query: <T = any>(
    _text: string,
    _params?: any[],
  ) => E.Effect<{ rows: T[]; rowCount: number }, DatabaseError>;
  readonly getClient: () => E.Effect<PoolClient, DatabaseError>;
  readonly transaction: <T>(
    _fn: (_client: PoolClient) => E.Effect<T, DatabaseError>,
  ) => E.Effect<T, DatabaseError>;
  readonly close: () => E.Effect<void, never>;
  // Soft delete operations
  readonly softDelete: (_tableName: string, _recordId: string) => E.Effect<boolean, DatabaseError>;
  readonly restore: (_tableName: string, _recordId: string) => E.Effect<boolean, DatabaseError>;
  readonly permanentDelete: (
    _tableName: string,
    _recordId: string,
  ) => E.Effect<boolean, DatabaseError>;
}

/**
 * Database error types
 */
export class DatabaseError extends Error {
  readonly _tag = 'DatabaseError';
  public readonly errorCause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.errorCause = cause;
  }
}

/**
 * Database service tag for dependency injection
 */
export const DatabaseService = Context.GenericTag<DatabaseService>('DatabaseService');

/**
 * Create database service implementation
 */
const makeDatabaseService = E.gen(function* () {
  const databaseUrl = yield* envVars.DATABASE_URL;

  yield* E.logInfo('Initializing database connection pool');

  const pool = new Pool({
    connectionString: Redacted.value(databaseUrl),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test the connection
  yield* E.tryPromise({
    try: () => pool.query('SELECT NOW()'),
    catch: error => new DatabaseError('Failed to connect to database', error),
  });

  yield* E.logInfo('Database connection pool initialized successfully');

  const query = <T = any>(text: string, params?: any[]) =>
    E.tryPromise({
      try: async () => {
        const result = await pool.query(text, params);
        return { rows: result.rows as T[], rowCount: result.rowCount || 0 };
      },
      catch: error => new DatabaseError(`Query failed: ${text}`, error),
    }).pipe(
      E.tapError(error => E.logError('Database query failed', { text, params, error })),
      E.withSpan('database-query', { attributes: { query: text } }),
    );

  const getClient = () =>
    E.tryPromise({
      try: () => pool.connect(),
      catch: error => new DatabaseError('Failed to get database client', error),
    });

  const transaction = <T>(
    fn: (_client: PoolClient) => E.Effect<T, DatabaseError>,
  ): E.Effect<T, DatabaseError> =>
    E.scoped(
      E.gen(function* () {
        const client = yield* E.acquireRelease(getClient(), _client =>
          E.sync(() => _client.release()),
        );

        // Begin transaction
        yield* E.tryPromise({
          try: () => client.query('BEGIN'),
          catch: error => new DatabaseError('Failed to begin transaction', error),
        });

        // Execute the function and handle commit/rollback
        const result = yield* fn(client).pipe(
          E.tap(() =>
            E.tryPromise({
              try: () => client.query('COMMIT'),
              catch: error => new DatabaseError('Failed to commit transaction', error),
            }),
          ),
          E.tapError(() =>
            E.tryPromise({
              try: () => client.query('ROLLBACK'),
              catch: rollbackError =>
                new DatabaseError('Failed to rollback transaction', rollbackError),
            }).pipe(E.ignore),
          ),
        );

        return result;
      }).pipe(E.withSpan('database-transaction')),
    );

  const close = () =>
    E.gen(function* () {
      yield* E.logInfo('Closing database connection pool');
      yield* E.tryPromise({
        try: () => pool.end(),
        catch: error => new DatabaseError('Failed to close database connection pool', error),
      });
      yield* E.logInfo('Database connection pool closed');
    }).pipe(E.ignore);

  // Soft delete operations
  const softDelete = (tableName: string, recordId: string) =>
    E.tryPromise({
      try: async () => {
        const result = await pool.query('SELECT app_private.soft_delete_record($1, $2)', [
          tableName,
          recordId,
        ]);
        return result.rows[0]?.soft_delete_record || false;
      },
      catch: error => new DatabaseError(`Soft delete failed for ${tableName}:${recordId}`, error),
    }).pipe(
      E.tapError(error => E.logError('Soft delete failed', { tableName, recordId, error })),
      E.withSpan('database-soft-delete', { attributes: { tableName, recordId } }),
    );

  const restore = (tableName: string, recordId: string) =>
    E.tryPromise({
      try: async () => {
        const result = await pool.query('SELECT app_private.restore_record($1, $2)', [
          tableName,
          recordId,
        ]);
        return result.rows[0]?.restore_record || false;
      },
      catch: error => new DatabaseError(`Restore failed for ${tableName}:${recordId}`, error),
    }).pipe(
      E.tapError(error => E.logError('Restore failed', { tableName, recordId, error })),
      E.withSpan('database-restore', { attributes: { tableName, recordId } }),
    );

  const permanentDelete = (tableName: string, recordId: string) =>
    E.tryPromise({
      try: async () => {
        // This bypasses the trigger by using a special function
        const result = await pool.query(
          `DELETE FROM ${tableName} WHERE id = $1 AND deleted_at IS NOT NULL`,
          [recordId],
        );
        return (result.rowCount ?? 0) > 0;
      },
      catch: error =>
        new DatabaseError(`Permanent delete failed for ${tableName}:${recordId}`, error),
    }).pipe(
      E.tapError(error => E.logError('Permanent delete failed', { tableName, recordId, error })),
      E.withSpan('database-permanent-delete', { attributes: { tableName, recordId } }),
    );

  return {
    query,
    getClient,
    transaction,
    close,
    softDelete,
    restore,
    permanentDelete,
  } satisfies DatabaseService;
});

/**
 * Database service layer
 */
export const DatabaseServiceLive = Layer.effect(DatabaseService, makeDatabaseService);

/**
 * Default database service layer
 */
export const DefaultDatabaseService = DatabaseServiceLive;

/**
 * Test database service for testing
 */
export const TestDatabaseService = Layer.succeed(DatabaseService, {
  query: <T = any>(_text: string, _params?: any[]) => E.succeed({ rows: [] as T[], rowCount: 0 }),
  getClient: () => E.die('TestDatabaseService.getClient not implemented'),
  transaction: <T>(_fn: (_client: PoolClient) => E.Effect<T, DatabaseError>) =>
    E.die('TestDatabaseService.transaction not implemented'),
  close: () => E.succeed(undefined),
  softDelete: (_tableName: string, _recordId: string) => E.succeed(true),
  restore: (_tableName: string, _recordId: string) => E.succeed(true),
  permanentDelete: (_tableName: string, _recordId: string) => E.succeed(true),
} satisfies DatabaseService);
