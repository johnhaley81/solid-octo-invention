import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Effect as E } from 'effect';
import { WorkerService, TestWorkerService } from './worker';

// Mock nodemailer for testing
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: vi.fn().mockResolvedValue(true),
  })),
}));

describe('WorkerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Jobs', () => {
    it('should handle send-verification-email job', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        const jobPayload = {
          email: 'test@example.com',
          name: 'Test User',
          token: 'verification-token-123',
        };
        
        const result = yield* worker.addJob('send-verification-email', jobPayload);
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(result).toMatchObject({
        id: expect.any(String),
        task_identifier: 'send-verification-email',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          token: 'verification-token-123',
        },
      });
    });

    it('should handle send-login-otp job', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        const jobPayload = {
          email: 'test@example.com',
          name: 'Test User',
          otp: '123456',
        };
        
        const result = yield* worker.addJob('send-login-otp', jobPayload);
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(result).toMatchObject({
        id: expect.any(String),
        task_identifier: 'send-login-otp',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          otp: '123456',
        },
      });
    });

    it('should handle send-password-reset-email job', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        const jobPayload = {
          email: 'test@example.com',
          name: 'Test User',
          token: 'reset-token-456',
        };
        
        const result = yield* worker.addJob('send-password-reset-email', jobPayload);
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(result).toMatchObject({
        id: expect.any(String),
        task_identifier: 'send-password-reset-email',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          token: 'reset-token-456',
        },
      });
    });

    it('should handle send-auth-method-change-notification job', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        const jobPayload = {
          email: 'test@example.com',
          name: 'Test User',
          oldMethod: 'password' as const,
          newMethod: 'webauthn' as const,
        };
        
        const result = yield* worker.addJob('send-auth-method-change-notification', jobPayload);
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(result).toMatchObject({
        id: expect.any(String),
        task_identifier: 'send-auth-method-change-notification',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          oldMethod: 'password',
          newMethod: 'webauthn',
        },
      });
    });
  });

  describe('Cleanup Jobs', () => {
    it('should handle cleanup-expired-auth-data job', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        const result = yield* worker.addJob('cleanup-expired-auth-data', {});
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(result).toMatchObject({
        id: expect.any(String),
        task_identifier: 'cleanup-expired-auth-data',
        payload: {},
      });
    });
  });

  describe('Job Scheduling', () => {
    it('should schedule recurring cleanup job', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        // Schedule cleanup to run every hour
        const result = yield* worker.addJob('cleanup-expired-auth-data', {}, {
          runAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          maxAttempts: 3,
        });
        
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(result).toMatchObject({
        id: expect.any(String),
        task_identifier: 'cleanup-expired-auth-data',
        max_attempts: 3,
      });
      expect(new Date(result.run_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle job retry logic', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        const result = yield* worker.addJob('send-verification-email', {
          email: 'test@example.com',
          name: 'Test User',
          token: 'token-123',
        }, {
          maxAttempts: 5,
          backoffDelay: 1000,
        });
        
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(result).toMatchObject({
        id: expect.any(String),
        task_identifier: 'send-verification-email',
        max_attempts: 5,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid job types', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        // Try to add an invalid job type
        yield* worker.addJob('invalid-job-type' as any, {});
      });

      await expect(
        E.runPromise(program.pipe(E.provide(TestWorkerService))),
      ).rejects.toThrow();
    });

    it('should handle missing required payload fields', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        // Try to add email job without required fields
        yield* worker.addJob('send-verification-email', {} as any);
      });

      await expect(
        E.runPromise(program.pipe(E.provide(TestWorkerService))),
      ).rejects.toThrow();
    });
  });

  describe('Job Processing', () => {
    it('should process jobs in correct order', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        // Add multiple jobs
        const job1 = yield* worker.addJob('send-verification-email', {
          email: 'user1@example.com',
          name: 'User 1',
          token: 'token-1',
        });
        
        const job2 = yield* worker.addJob('send-login-otp', {
          email: 'user2@example.com',
          name: 'User 2',
          otp: '123456',
        });
        
        const job3 = yield* worker.addJob('cleanup-expired-auth-data', {});
        
        return [job1, job2, job3];
      });

      const results = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(results).toHaveLength(3);
      expect(results[0].task_identifier).toBe('send-verification-email');
      expect(results[1].task_identifier).toBe('send-login-otp');
      expect(results[2].task_identifier).toBe('cleanup-expired-auth-data');
    });

    it('should handle concurrent job processing', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        // Add jobs concurrently
        const jobs = yield* E.all([
          worker.addJob('send-verification-email', {
            email: 'user1@example.com',
            name: 'User 1',
            token: 'token-1',
          }),
          worker.addJob('send-verification-email', {
            email: 'user2@example.com',
            name: 'User 2',
            token: 'token-2',
          }),
          worker.addJob('send-verification-email', {
            email: 'user3@example.com',
            name: 'User 3',
            token: 'token-3',
          }),
        ], { concurrency: 'unbounded' });
        
        return jobs;
      });

      const results = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.task_identifier).toBe('send-verification-email');
        expect(result.id).toBeDefined();
      });
    });
  });

  describe('Service Integration', () => {
    it('should integrate with database service for cleanup jobs', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        // This would typically interact with the database service
        // For now, just test that the job is created correctly
        const result = yield* worker.addJob('cleanup-expired-auth-data', {});
        
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(result).toMatchObject({
        task_identifier: 'cleanup-expired-auth-data',
        payload: {},
      });
    });

    it('should handle email service integration', async () => {
      const program = E.gen(function* () {
        const worker = yield* WorkerService;
        
        // Test email job creation (actual sending would be handled by the worker)
        const result = yield* worker.addJob('send-verification-email', {
          email: 'integration@example.com',
          name: 'Integration Test',
          token: 'integration-token',
        });
        
        return result;
      });

      const result = await E.runPromise(program.pipe(E.provide(TestWorkerService)));
      
      expect(result).toMatchObject({
        task_identifier: 'send-verification-email',
        payload: {
          email: 'integration@example.com',
          name: 'Integration Test',
          token: 'integration-token',
        },
      });
    });
  });
});

