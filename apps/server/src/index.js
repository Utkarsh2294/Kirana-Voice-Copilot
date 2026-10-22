import mongoose from 'mongoose';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const logger = createLogger();
const app = createApp({
  config,
  logger,
  isReady: async () => {
    if (mongoose.connection.readyState !== 1) return false;
    await mongoose.connection.db.admin().ping();
    return true;
  },
});
const server = app.listen(config.PORT, '0.0.0.0', () =>
  logger.info({ port: config.PORT }, 'API listening'),
);
let stopping = false;
let retry;
async function connect() {
  try {
    await mongoose.connect(config.MONGO_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
  } catch {
    logger.warn({ code: 'MONGO_CONNECT_FAILED' }, 'Database unavailable; retrying in five seconds');
    if (!stopping) retry = setTimeout(connect, 5000);
  }
}
connect();

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearTimeout(retry);
  logger.info({ signal }, 'Shutting down');
  const deadline = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    await mongoose.disconnect();
    clearTimeout(deadline);
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
