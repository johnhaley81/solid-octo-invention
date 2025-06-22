import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { postgraphile } from 'postgraphile';
import { Effect as E, Layer, Logger, LogLevel, Redacted } from 'effect';
import { NodeRuntime } from '@effect/platform-node';
import { envVars } from './config/index.js';
import { DatabaseService, DatabaseServiceLive } from './services/database.js';
import { WorkerService, WorkerServiceLive } from './services/worker.js';
import authRoutes from './routes/auth.js';
import { optionalAuth } from './middleware/auth.js';

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

  // Initialize services
  const databaseService = yield* DatabaseService;
  const workerService = yield* WorkerService;

  // Create Express app
  const app = express();

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: nodeEnv === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

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

  // Authentication routes
  app.use('/api/auth', authRoutes);

  // Optional authentication middleware for GraphQL
  app.use('/graphql', optionalAuth);

  // PostGraphile middleware
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
      pgSettings: req => ({
        // Set PostgreSQL settings based on request context
        role: req.user ? 'authenticated_user' : 'anonymous_user',
        'app.current_user_id': req.user?.id || null,
      }),
    }),
  );

  // Error handling middleware
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Express error:', err.message, err.stack);
      res.status(500).json({
        error: nodeEnv === 'development' ? err.message : 'Internal server error',
      });
    },
  );

  // Start the server
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

  // Graceful shutdown
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
  process.on('SIGTERM', () => {
    E.runPromise(shutdown()).catch(console.error);
  });

  process.on('SIGINT', () => {
    E.runPromise(shutdown()).catch(console.error);
  });

  return server;
}).pipe(
  E.tapError(error => E.logError('Failed to start server', { error })),
  E.withSpan('server-startup'),
);

/**
 * Main application layer with all dependencies
 */
const MainLayer = Layer.mergeAll(DatabaseServiceLive, WorkerServiceLive);

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
);

// Run the program
NodeRuntime.runMain(program);
