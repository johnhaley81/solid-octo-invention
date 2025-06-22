import { Effect as E, Layer, Context, Schedule } from 'effect'
import { run, Worker, WorkerPool } from 'graphile-worker'
import { envVars } from '../config/index.js'

/**
 * Worker service interface for background job processing
 */
export interface WorkerService {
  readonly addJob: (taskIdentifier: string, payload?: any, options?: JobOptions) => E.Effect<void, WorkerError>
  readonly shutdown: () => E.Effect<void, never>
}

/**
 * Job options for worker tasks
 */
export interface JobOptions {
  readonly runAt?: Date
  readonly maxAttempts?: number
  readonly priority?: number
  readonly jobKey?: string
}

/**
 * Worker error types
 */
export class WorkerError extends Error {
  readonly _tag = 'WorkerError'
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
  }
}

/**
 * Worker service tag for dependency injection
 */
export const WorkerService = Context.GenericTag<WorkerService>('WorkerService')

/**
 * Task handlers registry
 */
const taskHandlers = {
  // Example task handlers
  'send-email': async (payload: { to: string; subject: string; body: string }) => {
    console.log('Sending email:', payload)
    // Implement email sending logic here
  },
  
  'process-image': async (payload: { imageUrl: string; userId: string }) => {
    console.log('Processing image:', payload)
    // Implement image processing logic here
  },
  
  'cleanup-expired-sessions': async () => {
    console.log('Cleaning up expired sessions')
    // Implement session cleanup logic here
  },
}

/**
 * Create worker service implementation
 */
const makeWorkerService = E.gen(function* () {
  const databaseUrl = yield* envVars.DATABASE_URL
  const concurrency = yield* envVars.WORKER_CONCURRENCY
  
  yield* E.logInfo('Initializing Graphile Worker', { concurrency })
  
  // Start the worker
  const workerPool = yield* E.tryPromise({
    try: () => run({
      connectionString: databaseUrl,
      concurrency,
      taskList: taskHandlers,
      pollInterval: 1000,
      // Worker will automatically retry failed jobs
      noHandleSignals: true,
    }),
    catch: (error) => new WorkerError('Failed to start worker', error)
  })
  
  yield* E.logInfo('Graphile Worker started successfully')
  
  const addJob = (taskIdentifier: string, payload?: any, options?: JobOptions) =>
    E.gen(function* () {
      yield* E.logInfo('Adding job to queue', { taskIdentifier, payload, options })
      
      yield* E.tryPromise({
        try: () => workerPool.addJob(taskIdentifier, payload, {
          runAt: options?.runAt,
          maxAttempts: options?.maxAttempts || 3,
          priority: options?.priority || 0,
          jobKey: options?.jobKey,
        }),
        catch: (error) => new WorkerError(`Failed to add job: ${taskIdentifier}`, error)
      })
      
      yield* E.logInfo('Job added successfully', { taskIdentifier })
    }).pipe(
      E.withSpan('worker-add-job', { attributes: { taskIdentifier } })
    )
  
  const shutdown = () =>
    E.gen(function* () {
      yield* E.logInfo('Shutting down Graphile Worker')
      
      yield* E.tryPromise({
        try: () => workerPool.gracefulShutdown(5000), // 5 second timeout
        catch: (error) => {
          yield* E.logError('Failed to gracefully shutdown worker', { error })
        }
      }).pipe(E.ignore)
      
      yield* E.logInfo('Graphile Worker shutdown complete')
    })
  
  return {
    addJob,
    shutdown,
  } satisfies WorkerService
})

/**
 * Worker service layer
 */
export const WorkerServiceLive = Layer.effect(WorkerService, makeWorkerService)

/**
 * Default worker service layer
 */
WorkerService.Default = WorkerServiceLive

/**
 * Test worker service for testing
 */
export const TestWorkerService = Layer.succeed(WorkerService, {
  addJob: (taskIdentifier: string, payload?: any, options?: JobOptions) => 
    E.logInfo('Test worker: job added', { taskIdentifier, payload, options }),
  shutdown: () => E.succeed(undefined),
} satisfies WorkerService)

/**
 * Utility functions for common job patterns
 */
export const WorkerUtils = {
  /**
   * Schedule a job to run at a specific time
   */
  scheduleJob: (taskIdentifier: string, payload: any, runAt: Date) =>
    E.gen(function* () {
      const workerService = yield* WorkerService
      yield* workerService.addJob(taskIdentifier, payload, { runAt })
    }),
  
  /**
   * Schedule a recurring job (this would typically be handled by a cron job or scheduler)
   */
  scheduleRecurringJob: (taskIdentifier: string, payload: any, schedule: Schedule.Schedule<any, any, any>) =>
    E.gen(function* () {
      const workerService = yield* WorkerService
      
      // This is a simplified example - in practice, you'd want a more sophisticated scheduler
      yield* E.repeat(
        workerService.addJob(taskIdentifier, payload),
        schedule
      )
    }),
  
  /**
   * Add a high-priority job
   */
  addUrgentJob: (taskIdentifier: string, payload: any) =>
    E.gen(function* () {
      const workerService = yield* WorkerService
      yield* workerService.addJob(taskIdentifier, payload, { priority: 100 })
    }),
}

