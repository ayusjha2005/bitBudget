const app = require('./app');
const config = require('./config');

const { initializeSchemaAndSeed } = require('./db/client');

const PORT = config.port;

async function startServer() {
  try {
    console.log('[SafePay AI] Initializing database schema and seed records...');
    await initializeSchemaAndSeed();
    console.log('[SafePay AI] Database initialized successfully.');

    const server = app.listen(PORT, () => {
      console.log(`[SafePay AI] Server running securely on port ${PORT}`);
      console.log(`[SafePay AI] Environment: ${config.nodeEnv}`);
      console.log(`[SafePay AI] Healthz endpoint: http://localhost:${PORT}/healthz`);
    });

    process.on('SIGTERM', () => {
      console.log('[SafePay AI] Received SIGTERM, shutting down gracefully...');
      server.close(() => {
        console.log('[SafePay AI] Server closed.');
        process.exit(0);
      });
    });

    return server;
  } catch (err) {
    console.error('[SafePay AI] Fatal startup error:', err);
    process.exit(1);
  }
}

const serverPromise = startServer();
module.exports = serverPromise;
