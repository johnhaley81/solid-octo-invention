import { Effect as E, Layer, Context, Schedule, Redacted } from 'effect';
import { run } from 'graphile-worker';
import { envVars } from '../config/index.js';

/**
 * Worker service interface for background job processing
 */
export interface WorkerService {
  readonly addJob: (
    _taskIdentifier: string,
    _payload?: any,
    _options?: JobOptions,
  ) => E.Effect<void, WorkerError>;
  readonly shutdown: () => E.Effect<void, never>;
}

/**
 * Job options for worker tasks
 */
export interface JobOptions {
  readonly runAt?: Date;
  readonly maxAttempts?: number;
  readonly priority?: number;
  readonly jobKey?: string;
}

/**
 * Worker error types
 */
export class WorkerError extends Error {
  readonly _tag = 'WorkerError';
  public readonly errorCause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.errorCause = cause;
  }
}

/**
 * Worker service tag for dependency injection
 */
export const WorkerService = Context.GenericTag<WorkerService>('WorkerService');

/**
 * Task handlers registry
 */
const taskHandlers = {
  // Authentication-related tasks
  'send-verification-email': async (payload: unknown) => {
    const typedPayload = payload as {
      userId: string;
      email: string;
      token: string;
      name: string;
    };
    console.log('Sending verification email:', {
      email: typedPayload.email,
      userId: typedPayload.userId,
    });
    // TODO: Implement email sending with verification link
    // This would use nodemailer or similar service
  },

  'send-login-otp': async (payload: unknown) => {
    const typedPayload = payload as {
      userId: string;
      email: string;
      otp: string;
      name: string;
    };
    console.log('Sending login OTP:', { email: typedPayload.email, userId: typedPayload.userId });
    // TODO: Implement OTP email sending
  },

  'send-password-reset-email': async (payload: unknown) => {
    const typedPayload = payload as {
      userId: string;
      email: string;
      token: string;
      name: string;
    };
    console.log('Sending password reset email:', {
      email: typedPayload.email,
      userId: typedPayload.userId,
    });
    // TODO: Implement password reset email
  },

  'cleanup-expired-auth-data': async (_payload: unknown) => {
    console.log('Cleaning up expired authentication data');
    // TODO: Implement cleanup of expired OTP tokens, sessions, etc.
    // This would run periodically via cron job
  },

  'send-auth-method-change-notification': async (payload: unknown) => {
    const typedPayload = payload as {
      userId: string;
      email: string;
      oldMethod: string;
      newMethod: string;
      name: string;
    };
    console.log('Sending auth method change notification:', {
      email: typedPayload.email,
      change: `${typedPayload.oldMethod} -> ${typedPayload.newMethod}`,
    });
    // TODO: Implement security notification email
  },

  // Example task handlers
  'send-email': async (payload: unknown) => {
    const typedPayload = payload as { to: string; subject: string; body: string };
    console.log('Sending email:', typedPayload);
    // Implement email sending logic here
  },

  'process-image': async (payload: unknown) => {
    const typedPayload = payload as { imageUrl: string; userId: string };
    console.log('Processing image:', typedPayload);
    // Implement image processing logic here
  },

  'cleanup-expired-sessions': async (_payload: unknown) => {
    console.log('Cleaning up expired sessions');
    // Implement session cleanup logic here
  },
};

/**
 * Create worker service implementation
 */
const makeWorkerService = E.gen(function* () {
  const databaseUrl = yield* envVars.DATABASE_URL;
  const concurrency = yield* envVars.WORKER_CONCURRENCY;

  yield* E.logInfo('Initializing Graphile Worker', { concurrency });

  // Start the worker
  const workerPool = yield* E.tryPromise({
    try: () =>
      run({
        connectionString: Redacted.value(databaseUrl),
        concurrency,
        taskList: taskHandlers,
        pollInterval: 1000,
        // Worker will automatically retry failed jobs
        noHandleSignals: true,
      }),
    catch: error => new WorkerError('Failed to start worker', error),
  });

  yield* E.logInfo('Graphile Worker started successfully');

  const addJob = (taskIdentifier: string, payload?: any, options?: JobOptions) =>
    E.gen(function* () {
      yield* E.logInfo('Adding job to queue', { taskIdentifier, payload, options });

      yield* E.tryPromise({
        try: () =>
          workerPool.addJob(taskIdentifier, payload, {
            ...(options?.runAt && { runAt: options.runAt }),
            maxAttempts: options?.maxAttempts || 3,
            priority: options?.priority || 0,
            ...(options?.jobKey && { jobKey: options.jobKey }),
          }),
        catch: error => new WorkerError(`Failed to add job: ${taskIdentifier}`, error),
      });

      yield* E.logInfo('Job added successfully', { taskIdentifier });
    }).pipe(E.withSpan('worker-add-job', { attributes: { taskIdentifier } }));

  const shutdown = () =>
    E.gen(function* () {
      yield* E.logInfo('Shutting down Graphile Worker');

      yield* E.tryPromise({
        try: () => workerPool.stop(), // Use stop() instead of gracefulShutdown
        catch: error => new Error(`Failed to shutdown worker: ${error}`),
      }).pipe(
        E.tapError(error => E.logError('Failed to gracefully shutdown worker', { error })),
        E.ignore,
      );

      yield* E.logInfo('Graphile Worker shutdown complete');
    });

  return {
    addJob,
    shutdown,
  } satisfies WorkerService;
});

/**
 * Worker service layer
 */
export const WorkerServiceLive = Layer.effect(WorkerService, makeWorkerService);

/**
 * Default worker service layer
 */
// WorkerService.Default = WorkerServiceLive

/**
 * Test worker service for testing
 */
export const TestWorkerService = Layer.succeed(WorkerService, {
  addJob: (taskIdentifier: string, payload?: any, options?: JobOptions) =>
    E.logInfo('Test worker: job added', { taskIdentifier, payload, options }),
  shutdown: () => E.succeed(undefined),
} satisfies WorkerService);

/**
 * Utility functions for common job patterns
 */
export const WorkerUtils = {
  /**
   * Schedule a job to run at a specific time
   */
  scheduleJob: (taskIdentifier: string, payload: any, runAt: Date) =>
    E.gen(function* () {
      const workerService = yield* WorkerService;
      yield* workerService.addJob(taskIdentifier, payload, { runAt });
    }),

  /**
   * Schedule a recurring job (this would typically be handled by a cron job or scheduler)
   */
  scheduleRecurringJob: (
    taskIdentifier: string,
    payload: any,
    schedule: Schedule.Schedule<any, any, any>,
  ) =>
    E.gen(function* () {
      const workerService = yield* WorkerService;

      // This is a simplified example - in practice, you'd want a more sophisticated scheduler
      yield* E.repeat(workerService.addJob(taskIdentifier, payload), schedule);
    }),

  /**
   * Add a high-priority job
   */
  addUrgentJob: (taskIdentifier: string, payload: any) =>
    E.gen(function* () {
      const workerService = yield* WorkerService;
      yield* workerService.addJob(taskIdentifier, payload, { priority: 100 });
    }),
};
