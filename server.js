#!/usr/bin/env node

const app = require('./src/app');
const db = require('./src/config/database');
const { testEmailConfig } = require('./src/config/email');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    // Test database connection
    console.log('🔍 Testing database connection...');
    await db.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Test email configuration (optional)
    console.log('🔍 Testing email configuration...');
    await testEmailConfig();

    // Start the server
    const server = app.listen(PORT, HOST, () => {
      console.log('🚀 Authentication System Server Started');
      console.log(`📍 Server running on http://${HOST}:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('🔐 Authentication Methods Available:');
      console.log('   • Email/Password + OTP');
      console.log('   • WebAuthn Passkeys (Touch ID, Face ID, Windows Hello)');
      console.log('');
      console.log('📚 API Endpoints:');
      console.log('   • POST /api/auth/register - Register with email/password');
      console.log('   • POST /api/auth/login - Login with email/password + OTP');
      console.log('   • POST /api/auth/webauthn/register/begin - Start WebAuthn registration');
      console.log('   • POST /api/auth/webauthn/authenticate/begin - Start WebAuthn login');
      console.log('   • GET  /api/auth/me - Get current user info');
      console.log('   • GET  /api/health - Health check');
      console.log('');
      console.log('🎯 Ready to accept connections!');
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      server.close(() => {
        console.log('✅ HTTP server closed');
        
        // Close database connections
        db.pool.end(() => {
          console.log('✅ Database connections closed');
          process.exit(0);
        });
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle startup errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception during startup:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection during startup:', reason);
  process.exit(1);
});

// Start the server
startServer();

