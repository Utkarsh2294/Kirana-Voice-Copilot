import { loadEnvFile } from 'node:process';
import mongoose from 'mongoose';
import { loadConfig } from '../apps/server/src/config.js';
import { createLogger } from '../apps/server/src/logger.js';
import { createPricingService } from '../apps/server/src/pricing-service.js';
import { createMarketJobs } from '../apps/server/src/market-feeds.js';
import { ensurePricingIndexes } from '../apps/server/src/pricing-models.js';
try {
  loadEnvFile(new URL('../apps/server/.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const config = loadConfig();
try {
  await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await ensurePricingIndexes();
  const pricing = createPricingService({ config });
  const jobs = createMarketJobs({ config, pricing, logger: createLogger() });
  process.stdout.write(JSON.stringify(await jobs.run()) + '\n');
} finally {
  await mongoose.disconnect();
}
