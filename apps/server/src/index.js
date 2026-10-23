import cron from 'node-cron';
import { createPricingService } from './pricing-service.js';
import { createMarketJobs } from './market-feeds.js';
import { ensurePricingIndexes } from './pricing-models.js';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { ensureCoreIndexes } from './models.js';
import { ensureCatalogIndexes } from './catalog-models.js';
import { catalogService } from './catalog-service.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const logger = createLogger();
const pricingService = createPricingService({ config });
const marketJobs = createMarketJobs({ config, pricing: pricingService, logger });
const marketTask = config.MARKET_JOBS_ENABLED
  ? cron.schedule('30 18 * * *', () => marketJobs.run().catch(() => {}), {
      timezone: 'Asia/Kolkata',
      noOverlap: true,
    })
  : null;
const app = createApp({
  pricingService,
  marketJobs,
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
    await ensureCoreIndexes();
    await ensureCatalogIndexes();
    await ensurePricingIndexes();
    await catalogService.reload();
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
  marketTask?.stop();
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
