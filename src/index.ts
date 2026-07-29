import { registerBuiltinAgents } from './agents/index.js';
import { createApp } from './app.js';
import { loadConfig } from './config/index.js';
import { logger } from './lib/logger.js';
import { closeDb, getDb } from './models/db.js';

/**
 * Application entrypoint: register agents, initialise the datastore, start
 * the HTTP server, and wire up graceful shutdown.
 */
function main(): void {
  const config = loadConfig();

  registerBuiltinAgents();
  // Initialise the database (creates the file/schema if needed).
  getDb();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Server listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
