import { describe, it, expect, beforeEach } from 'vitest';
import { Effect as E, Layer } from 'effect';
import { DatabaseService } from './database.js';

/**
 * Mock database service for testing soft delete functionality
 */
const createMockDatabaseService = () => {
  const mockRecords = new Map<string, { id: string; deleted_at: string | null }>();

  // Add some test records
  mockRecords.set('users:user-1', { id: 'user-1', deleted_at: null });
  mockRecords.set('users:user-2', { id: 'user-2', deleted_at: null });
  mockRecords.set('users:user-3', { id: 'user-3', deleted_at: '2023-01-01T00:00:00Z' });

  return Layer.succeed(DatabaseService, {
    query: <T = any>(text: string, params?: any[]) => {
      // Mock query responses based on the SQL
      if (text.includes('soft_delete_record')) {
        const [tableName, recordId] = params || [];
        const key = `${tableName}:${recordId}`;
        const record = mockRecords.get(key);

        if (record && record.deleted_at === null) {
          record.deleted_at = new Date().toISOString();
          return E.succeed([{ soft_delete_record: true }] as T[]);
        }
        return E.succeed([{ soft_delete_record: false }] as T[]);
      }

      if (text.includes('restore_record')) {
        const [tableName, recordId] = params || [];
        const key = `${tableName}:${recordId}`;
        const record = mockRecords.get(key);

        if (record && record.deleted_at !== null) {
          record.deleted_at = null;
          return E.succeed([{ restore_record: true }] as T[]);
        }
        return E.succeed([{ restore_record: false }] as T[]);
      }

      return E.succeed([] as T[]);
    },
    getClient: () => E.die('MockDatabaseService.getClient not implemented'),
    transaction: (_fn: any) => E.die('MockDatabaseService.transaction not implemented'),
    close: () => E.succeed(undefined),

    softDelete: (tableName: string, recordId: string) => {
      const key = `${tableName}:${recordId}`;
      const record = mockRecords.get(key);

      if (record && record.deleted_at === null) {
        record.deleted_at = new Date().toISOString();
        return E.succeed(true);
      }
      return E.succeed(false);
    },

    restore: (tableName: string, recordId: string) => {
      const key = `${tableName}:${recordId}`;
      const record = mockRecords.get(key);

      if (record && record.deleted_at !== null) {
        record.deleted_at = null;
        return E.succeed(true);
      }
      return E.succeed(false);
    },

    permanentDelete: (tableName: string, recordId: string) => {
      const key = `${tableName}:${recordId}`;
      const record = mockRecords.get(key);

      if (record && record.deleted_at !== null) {
        mockRecords.delete(key);
        return E.succeed(true);
      }
      return E.succeed(false);
    },
  } satisfies DatabaseService);
};

describe('Soft Delete Functionality', () => {
  let mockLayer: Layer.Layer<DatabaseService>;

  beforeEach(() => {
    mockLayer = createMockDatabaseService();
  });

  describe('softDelete', () => {
    it('should soft delete an active record', async () => {
      const program = E.gen(function* () {
        const db = yield* DatabaseService;
        const result = yield* db.softDelete('users', 'user-1');
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(mockLayer)));
      expect(result).toBe(true);
    });

    it('should not soft delete an already deleted record', async () => {
      const program = E.gen(function* () {
        const db = yield* DatabaseService;
        const result = yield* db.softDelete('users', 'user-3');
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(mockLayer)));
      expect(result).toBe(false);
    });

    it('should not soft delete a non-existent record', async () => {
      const program = E.gen(function* () {
        const db = yield* DatabaseService;
        const result = yield* db.softDelete('users', 'non-existent');
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(mockLayer)));
      expect(result).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore a soft deleted record', async () => {
      const program = E.gen(function* () {
        const db = yield* DatabaseService;
        const result = yield* db.restore('users', 'user-3');
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(mockLayer)));
      expect(result).toBe(true);
    });

    it('should not restore an active record', async () => {
      const program = E.gen(function* () {
        const db = yield* DatabaseService;
        const result = yield* db.restore('users', 'user-1');
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(mockLayer)));
      expect(result).toBe(false);
    });

    it('should not restore a non-existent record', async () => {
      const program = E.gen(function* () {
        const db = yield* DatabaseService;
        const result = yield* db.restore('users', 'non-existent');
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(mockLayer)));
      expect(result).toBe(false);
    });
  });

  describe('permanentDelete', () => {
    it('should permanently delete a soft deleted record', async () => {
      const program = E.gen(function* () {
        const db = yield* DatabaseService;
        const result = yield* db.permanentDelete('users', 'user-3');
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(mockLayer)));
      expect(result).toBe(true);
    });

    it('should not permanently delete an active record', async () => {
      const program = E.gen(function* () {
        const db = yield* DatabaseService;
        const result = yield* db.permanentDelete('users', 'user-1');
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(mockLayer)));
      expect(result).toBe(false);
    });
  });

  describe('soft delete workflow', () => {
    it('should support complete soft delete workflow', async () => {
      const program = E.gen(function* () {
        const db = yield* DatabaseService;

        // 1. Soft delete an active record
        const softDeleteResult = yield* db.softDelete('users', 'user-2');

        // 2. Try to soft delete again (should fail)
        const softDeleteAgainResult = yield* db.softDelete('users', 'user-2');

        // 3. Restore the record
        const restoreResult = yield* db.restore('users', 'user-2');

        // 4. Try to restore again (should fail)
        const restoreAgainResult = yield* db.restore('users', 'user-2');

        return {
          softDeleteResult,
          softDeleteAgainResult,
          restoreResult,
          restoreAgainResult,
        };
      });

      const result = await E.runPromise(program.pipe(E.provide(mockLayer)));

      expect(result.softDeleteResult).toBe(true);
      expect(result.softDeleteAgainResult).toBe(false);
      expect(result.restoreResult).toBe(true);
      expect(result.restoreAgainResult).toBe(false);
    });
  });
});

describe('Database Service Integration', () => {
  it('should include soft delete methods in the service interface', () => {
    // This test ensures the interface includes the new methods
    const mockService: DatabaseService = {
      query: () => E.succeed([]),
      getClient: () => E.die('Not implemented'),
      transaction: () => E.die('Not implemented'),
      close: () => E.succeed(undefined),
      softDelete: () => E.succeed(true),
      restore: () => E.succeed(true),
      permanentDelete: () => E.succeed(true),
    };

    expect(typeof mockService.softDelete).toBe('function');
    expect(typeof mockService.restore).toBe('function');
    expect(typeof mockService.permanentDelete).toBe('function');
  });
});
