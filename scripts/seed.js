import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import mongoose from 'mongoose';
import { catalogItemSchema } from '@kirana/shared/catalog';
import { CatalogItem, ensureCatalogIndexes } from '../apps/server/src/catalog-models.js';
import { loadConfig } from '../apps/server/src/config.js';

try {
  loadEnvFile(new URL('../apps/server/.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const config = loadConfig();
const items = JSON.parse(
  await readFile(new URL('../apps/server/src/data/catalog.json', import.meta.url), 'utf8'),
).map((item) => catalogItemSchema.parse(item));
try {
  await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await ensureCatalogIndexes();
  const result = await CatalogItem.bulkWrite(
    items.map((item) => ({
      updateOne: { filter: { _id: item._id }, update: { $setOnInsert: item }, upsert: true },
    })),
    { ordered: false },
  );
  process.stdout.write(
    `Catalog: ${items.length} draft items; ${result.upsertedCount} inserted. Existing items and merchant overrides preserved.\n`,
  );
} finally {
  await mongoose.disconnect();
}
