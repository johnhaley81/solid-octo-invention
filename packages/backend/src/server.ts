import { config } from 'dotenv';
import express from 'express';

// Load environment variables from .env file (located in project root)
config({ path: '../../.env' });
import cors from 'cors';
import helmet from 'helmet';
import { postgraphile } from 'postgraphile';
import { Effect as E, Layer, Logger, LogLevel, Redacted } from 'effect';
import { NodeRuntime } from '@effect/platform-node';
import { envVars } from './config/index.js';
import { DatabaseService, DatabaseServiceLive } from './services/database.js';
import { WorkerService, WorkerServiceLive } from './services/worker.js';

/**
 * Main server application using Effect-TS
 */
const ServerProgram = E.gen(function* () {
  // Load configuration
  const port = yield* envVars.PORT;
  const nodeEnv = yield* envVars.NODE_ENV;
  const corsOrigin = yield* envVars.CORS_ORIGIN;
  const enableGraphiQL = yield* envVars.ENABLE_GRAPHIQL;
  const databaseUrl = yield* envVars.DATABASE_URL;

  yield* E.logInfo('Starting Solid Octo Invention server', {
    port,
    nodeEnv,
    enableGraphiQL,
  });

  // Create Express app first
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS configuration
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    });
  });

  // Start the server first (before database initialization)
  const server = app.listen(port, () => {
    console.log('Server started successfully', {
      port,
      graphqlEndpoint: `http://localhost:${port}/graphql`,
      healthEndpoint: `http://localhost:${port}/health`,
    });
  });

  yield* E.logInfo('Server started successfully', {
    port,
    graphqlEndpoint: `http://localhost:${port}/graphql`,
    healthEndpoint: `http://localhost:${port}/health`,
  });

  // Now try to initialize database services
  const databaseResult = yield* E.either(DatabaseService.pipe(E.provide(DatabaseServiceLive)));
  const workerResult = yield* E.either(WorkerService.pipe(E.provide(WorkerServiceLive)));
  
  if (E.isRight(databaseResult) && E.isRight(workerResult)) {
    const databaseService = databaseResult.right;
    const workerService = workerResult.right;

    // Add PostGraphile middleware after database is ready
    app.use(
      postgraphile(Redacted.value(databaseUrl), 'public', {
        watchPg: nodeEnv === 'development',
        graphiql: enableGraphiQL,
        enhanceGraphiql: true,
        dynamicJson: true,
        setofFunctionsContainNulls: false,
        ignoreRBAC: false,
        showErrorStack: nodeEnv === 'development' ? 'json' : false,
        extendedErrors: nodeEnv === 'development' ? ['hint', 'detail', 'errcode'] : ['errcode'],
        appendPlugins: [
          // Add PostGraphile plugins here as needed
        ],
        ...(nodeEnv === 'development' && { exportGqlSchemaPath: 'schema.graphql' }),
        sortExport: true,
        legacyRelations: 'omit',
        pgSettings: _req => ({
          // Set PostgreSQL settings based on request context
          role: 'postgres', // This should be dynamic based on authentication
        }),
      }),
    );

    yield* E.logInfo('PostGraphile middleware initialized successfully');
    
    // Store services for shutdown
    const shutdown = () =>
      E.gen(function* () {
        yield* E.logInfo('Shutting down server...');

        // Close worker connections
        yield* workerService.shutdown();

        // Close database connections
        yield* databaseService.close();

        // Close HTTP server
        yield* E.async<void>(resume => {
          server.close(err => {
            if (err) {
              resume(E.die(err));
            } else {
              resume(E.succeed(undefined));
            }
          });
        });

        yield* E.logInfo('Server shutdown complete');
      });

    // Handle shutdown signals
    process.on('SIGINT', () => E.runSync(shutdown()));
    process.on('SIGTERM', () => E.runSync(shutdown()));
  } else {
    const dbError = E.isLeft(databaseResult) ? databaseResult.left : null;
    const workerError = E.isLeft(workerResult) ? workerResult.left : null;
    
    yield* E.logWarning('Failed to initialize database services, GraphQL will not be available', { 
      databaseError: dbError, 
      workerError: workerError 
    });
    
    // Add a fallback endpoint for GraphQL when database is not available
    app.use('/graphql', (_req, res) => {
      res.status(503).json({
        error: 'Database not available',
        message: 'Please ensure the database is running and try again',
      });
    });
    
    // Simple shutdown for server-only mode
    const shutdown = () =>
      E.gen(function* () {
        yield* E.logInfo('Shutting down server...');

        // Close HTTP server
        yield* E.async<void>(resume => {
          server.close(err => {
            if (err) {
              resume(E.die(err));
            } else {
              resume(E.succeed(undefined));
            }
          });
        });

        yield* E.logInfo('Server shutdown complete');
      });

    // Handle shutdown signals
    process.on('SIGINT', () => E.runSync(shutdown()));
    process.on('SIGTERM', () => E.runSync(shutdown()));
  }

  // Error handling middleware
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Express error:', err.message, err.stack);
      res.status(500).json({
        error: nodeEnv === 'development' ? err.message : 'Internal server error',
      });
    },
  );

  return server;
}).pipe(
  E.tapError(error => E.logError('Failed to start server', { error })),
  E.withSpan('server-startup'),
);

/**
 * Main application layer with minimal dependencies (no database/worker services)
 * These services will be initialized conditionally within the program
 */
const MainLayer = Layer.empty;

/**
 * Logger configuration
 */
const LoggerLayer = Logger.replace(
  Logger.defaultLogger,
  Logger.make(({ logLevel, message, ...rest }) => {
    const timestamp = new Date().toISOString();
    const level = logLevel.label.toUpperCase();
    console.log(`[${timestamp}] ${level}: ${message}`, rest);
  }),
);

/**
 * Start the application
 */
const program = ServerProgram.pipe(
  E.provide(MainLayer),
  E.provide(LoggerLayer),
  Logger.withMinimumLogLevel(LogLevel.Info),
  E.catchAll(error =>
    E.gen(function* () {
      yield* E.logError('Failed to start server', { error });

      // Check if it's a database connection error
      if (error instanceof Error && error.message.includes('DATABASE_URL')) {
        console.error('\n🚨 DATABASE_URL Error:');
        console.error('The DATABASE_URL environment variable is missing or invalid.');
        console.error('\n📋 To fix this:');
        console.error('1. Make sure you have copied .env.example to .env:');
        console.error('   cp .env.example .env');
        console.error('2. Start the database services:');
        console.error('   pnpm db:up');
        console.error('3. Run database migrations:');
        console.error('   pnpm migrate:up');
        console.error('4. Then try running pnpm dev again');
      } else if (
        error instanceof Error &&
        (error.message.includes('connect') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('database'))
      ) {
        console.error('\n🚨 Database Connection Error:');
        console.error('Cannot connect to the PostgreSQL database.');
        console.error('\n📋 To fix this:');
        console.error('1. Make sure Docker is running on your system');
        console.error('2. Start the database services:');
        console.error('   pnpm db:up');
        console.error('3. Wait for the database to be ready, then run:');
        console.error('   pnpm migrate:up');
        console.error('4. Then try running pnpm dev again');
        console.error("\n💡 If you don't have Docker, you can:");
        console.error('- Install Docker Desktop from https://docker.com');
        console.error('- Or set up a local PostgreSQL instance and update DATABASE_URL in .env');
      }

      process.exit(1);
    }),
  ),
);

// Run the program
NodeRuntime.runMain(program);
