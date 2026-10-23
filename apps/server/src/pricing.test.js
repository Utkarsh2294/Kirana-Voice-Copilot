import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createPricingService } from './pricing-service.js';
import { createMarketJobs, fetchAgmarknet, wholesaleFromRecord } from './market-feeds.js';
import {
  MarketPrice,
  PriceHistory,
  CommodityMapping,
  PricingJob,
  ensurePricingIndexes,
} from './pricing-models.js';
import { catalogItemSchema } from '@kirana/shared/catalog';
import { createApp } from './app.js';
import { createLogger } from './logger.js';
import { loadConfig } from './config.js';
import { Merchant, RefreshToken, ensureCoreIndexes } from './models.js';
import { CatalogItem, MerchantItem, ensureCatalogIndexes } from './catalog-models.js';

const seed = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url), 'utf8'));
const rice = seed.find((item) => item.slug === 'rice');
let mongo, config, app, first, second, pricing;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24' }, replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'pricing-integration' });
  await ensureCoreIndexes();
  await ensureCatalogIndexes();
  await ensurePricingIndexes();
  await CatalogItem.insertMany([catalogItemSchema.parse(rice)]);
  config = loadConfig({
    MONGO_URI: mongo.getUri(),
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    PHONE_HMAC_SECRET: 'c'.repeat(40),
    PHONE_ENC_KEY: 'd'.repeat(64),
    RECO_API_KEY: 'e'.repeat(40),
    NODE_ENV: 'test',
  });
}, 180000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
async function account(phone) {
  const merchant = await Merchant.create({
    phone,
    storeName: 'Catalog test store',
    ownerName: 'Test owner',
    onboardingStep: 4,
    status: 'active',
    location: { regionId: 'test-region', state: 'Haryana', district: 'Gurugram' },
  });
  const family = randomUUID();
  await RefreshToken.create({
    merchantId: merchant._id,
    family,
    tokenHash: randomUUID(),
    expiresAt: new Date(Date.now() + 86400000),
  });
  const token = jwt.sign({ family }, config.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    issuer: 'kirana-api',
    audience: 'kirana-client',
    subject: String(merchant._id),
    expiresIn: 900,
  });
  return { merchant, token };
}
beforeEach(async () => {
  await Promise.all(
    [
      MerchantItem,
      Merchant,
      RefreshToken,
      MarketPrice,
      PriceHistory,
      CommodityMapping,
      PricingJob,
    ].map((model) => model.deleteMany({})),
  );
  first = await account('+919000000001');
  second = await account('+919000000002');
  pricing = createPricingService({ config });
  app = createApp({ config, pricingService: pricing, logger: createLogger({ level: 'silent' }) });
});
function call(method, path, body, token = first.token) {
  const target = request(app);
  const action = target[method](`/api/v1${path}`)
    .set('authorization', `Bearer ${token}`)
    .set('x-kirana-client', 'web');
  return body === undefined ? action : action.send(body);
}
const resolve = (token = first.token) =>
  call('post', '/pricing/resolve', { itemIds: [rice._id] }, token);
async function market(values = {}) {
  return MarketPrice.create({
    regionId: 'test-region',
    catalogItemId: rice._id,
    date: new Date(),
    source: 'simulated',
    retailEstimatePaise: 5500,
    sampleSize: 0,
    confidence: 0.7,
    ...values,
  });
}
it('resolves saved > regional > catalog and exposes honest fallback provenance', async () => {
  expect((await resolve()).body.prices[0]).toMatchObject({
    source: 'mrp',
    demo: true,
    pricePerBasePaise: 5200,
    fallbackReason: 'no-market',
    unit: 'kg',
    unitSize: 1000,
  });
  await market();
  pricing.invalidate();
  expect((await resolve()).body.prices[0]).toMatchObject({
    source: 'market',
    demo: true,
    pricePerBasePaise: 5500,
  });
  await call('put', `/merchant-items/${rice._id}/price`, { savedPricePaise: 6300 }).expect(200);
  await MarketPrice.deleteMany({});
  await market({ retailEstimatePaise: 5900 });
  pricing.invalidate();
  expect((await resolve()).body.prices[0]).toMatchObject({
    source: 'merchant',
    pricePerBasePaise: 6300,
    demo: false,
  });
  expect((await resolve(second.token)).body.prices[0]).toMatchObject({
    source: 'market',
    pricePerBasePaise: 5900,
  });
  const otherHistory = await call('get', `/pricing/history/${rice._id}`, undefined, second.token);
  expect(otherHistory.body.own).toEqual([]);
  const ownHistory = await call('get', `/pricing/history/${rice._id}`);
  expect(ownHistory.body.own[0]).toMatchObject({ oldPaise: null, newPaise: 6300, reason: 'saved' });
});
it('atomically resets and undoes prices while rejecting stale undo and cross-store tokens', async () => {
  const change = await call('put', `/merchant-items/${rice._id}/price`, {
    savedPricePaise: 6000,
  }).expect(200);
  await call(
    'put',
    `/merchant-items/${rice._id}/price`,
    { undoOf: change.body.undoId },
    second.token,
  ).expect(409);
  await call('put', `/merchant-items/${rice._id}/price`, { undoOf: change.body.undoId }).expect(
    200,
  );
  expect((await resolve()).body.prices[0].source).toBe('mrp');
  const newer = await call('put', `/merchant-items/${rice._id}/price`, { savedPricePaise: 6200 });
  await call('put', `/merchant-items/${rice._id}/price`, { savedPricePaise: 6400 });
  await call('put', `/merchant-items/${rice._id}/price`, { undoOf: newer.body.undoId }).expect(409);
  await call('put', `/merchant-items/${rice._id}/price`, { savedPricePaise: null }).expect(200);
  expect(await PriceHistory.countDocuments({ merchantId: first.merchant._id })).toBe(5);
});
it('falls back on disabled and low-confidence feeds and marks old estimates stale', async () => {
  await market({ confidence: 0.2 });
  pricing.invalidate();
  expect((await resolve()).body.prices[0]).toMatchObject({
    source: 'mrp',
    fallbackReason: 'low-confidence',
  });
  await MarketPrice.deleteMany({});
  await market({ date: new Date(Date.now() - 4 * 86400000) });
  pricing.invalidate();
  expect((await resolve()).body.prices[0]).toMatchObject({ source: 'market', stale: true });
  const offConfig = { ...config, MARKET_FEED: 'off' };
  const off = createPricingService({ config: offConfig });
  expect((await off.resolvePrices(first.merchant._id, [rice._id]))[0]).toMatchObject({
    source: 'mrp',
    fallbackReason: 'feed-off',
  });
});
it('publishes only five-or-more distinct recent merchants and exposes no individual samples', async () => {
  const crowdConfig = { ...config, MARKET_FEED: 'crowd' },
    crowdPricing = createPricingService({ config: crowdConfig });
  const jobs = createMarketJobs({
    config: crowdConfig,
    pricing: crowdPricing,
    logger: createLogger({ level: 'silent' }),
  });
  for (let i = 0; i < 4; i++) {
    const owner = await account(`+91900000010${i}`);
    await MerchantItem.create({
      merchantId: owner.merchant._id,
      catalogItemId: rice._id,
      savedPricePaise: 5000 + i * 100,
      priceSetAt: new Date(),
    });
  }
  await jobs.run();
  expect(await MarketPrice.countDocuments({ source: 'crowd' })).toBe(0);
  const fifth = await account('+919000000104');
  await MerchantItem.create({
    merchantId: fifth.merchant._id,
    catalogItemId: rice._id,
    savedPricePaise: 9999999,
    priceSetAt: new Date(),
  });
  await jobs.run();
  const row = await MarketPrice.findOne({ source: 'crowd' }).lean();
  expect(row).toMatchObject({ sampleSize: 5, retailEstimatePaise: 5200 });
  expect(Object.keys(row)).not.toContain('merchantId');
  expect((await crowdPricing.resolvePrices(first.merchant._id, [rice._id]))[0]).toMatchObject({
    source: 'market',
    demo: false,
    pricePerBasePaise: 5200,
  });
  const other = await account('+919000000105');
  await Merchant.updateOne(
    { _id: other.merchant._id },
    { $set: { 'location.regionId': 'other-region' } },
  );
  await MerchantItem.create({
    merchantId: other.merchant._id,
    catalogItemId: rice._id,
    savedPricePaise: 7000,
    priceSetAt: new Date(),
  });
  await jobs.run();
  expect(await MarketPrice.countDocuments({ regionId: 'other-region' })).toBe(0);
});
it('seeds deterministic daily demo history idempotently and respects next-day movement limits', async () => {
  let now = new Date('2026-10-23T12:00:00Z');
  const jobs = createMarketJobs({
    config,
    pricing,
    logger: createLogger({ level: 'silent' }),
    clock: () => now,
  });
  await jobs.run();
  expect(await MarketPrice.countDocuments()).toBe(30);
  const before = await MarketPrice.findOne().sort({ date: -1 }).lean();
  await jobs.run();
  expect(await MarketPrice.countDocuments()).toBe(30);
  now = new Date(+now + 86400000);
  await jobs.run();
  const after = await MarketPrice.findOne().sort({ date: -1 }).lean();
  expect(Math.abs(after.retailEstimatePaise - before.retailEstimatePaise)).toBeLessThanOrEqual(
    Math.ceil(before.retailEstimatePaise * 0.08),
  );
  expect(await MarketPrice.countDocuments()).toBe(31);
});
it('validates ownership, inputs and admin/region boundaries', async () => {
  await call('post', '/pricing/admin/ingest', {}).expect(403);
  await call('get', `/pricing/market?regionId=other&itemIds=${rice._id}`).expect(403);
  await call('put', `/merchant-items/${rice._id}/price`, { savedPricePaise: -1 }).expect(400);
  await call('put', `/merchant-items/${rice._id}/price`, { savedPricePaise: 1.1 }).expect(400);
  await call('post', '/pricing/resolve', {
    itemIds: [rice._id],
    merchantId: String(second.merchant._id),
  }).expect(400);
});
it('retries transient feed failures, validates units, and never silently applies a crop conversion', async () => {
  let calls = 0;
  const data = {
    records: [
      {
        state: 'Haryana',
        district: 'Gurugram',
        commodity: 'Paddy',
        arrival_date: '23/10/2026',
        min_price: '1900',
        max_price: '2100',
        modal_price: '2000',
      },
    ],
    total: 1,
  };
  const records = await fetchAgmarknet(
    { ...config, DATA_GOV_IN_API_KEY: 'fake-test-key' },
    {
      fetcher: async () => {
        calls++;
        return new Response(JSON.stringify(calls < 3 ? {} : data), {
          status: calls < 3 ? 503 : 200,
        });
      },
      wait: async () => {},
    },
  );
  expect(calls).toBe(3);
  expect(wholesaleFromRecord(records[0], { factorNumerator: 1, factorDenominator: 1 }).paise).toBe(
    2000,
  );
  expect(wholesaleFromRecord(records[0], { factorNumerator: 3, factorDenominator: 2 }).paise).toBe(
    3000,
  );
  await expect(fetchAgmarknet(config)).rejects.toMatchObject({ code: 'FEED_NOT_CONFIGURED' });
});

it('keeps discovered crop mappings inactive until a human approval is recorded', async () => {
  const liveConfig = { ...config, MARKET_FEED: 'agmarknet', DATA_GOV_IN_API_KEY: 'fake-test-key' };
  const livePricing = createPricingService({ config: liveConfig });
  const today = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
  const jobs = createMarketJobs({
    config: liveConfig,
    pricing: livePricing,
    logger: createLogger({ level: 'silent' }),
    fetcher: async () =>
      new Response(
        JSON.stringify({
          records: [
            {
              state: 'Haryana',
              district: 'Gurugram',
              commodity: 'Rice',
              arrival_date: today,
              min_price: '1900',
              max_price: '2100',
              modal_price: '2000',
            },
          ],
          total: 1,
        }),
      ),
  });
  expect(await jobs.discover({ state: 'Haryana', district: 'Gurugram' })).toEqual(['Rice']);
  const mapping = await CommodityMapping.create({
    commodity: 'Rice',
    catalogItemId: rice._id,
    factorNumerator: 1,
    factorDenominator: 1,
  });
  await jobs.run();
  expect(await MarketPrice.countDocuments({ source: 'agmarknet' })).toBe(0);
  await CommodityMapping.updateOne(
    { _id: mapping._id },
    { $set: { approvedAt: new Date(), approvedBy: first.merchant._id } },
  );
  await jobs.run();
  expect(await MarketPrice.findOne({ source: 'agmarknet' }).lean()).toMatchObject({
    wholesaleModalPaise: 2000,
    retailEstimatePaise: 2200,
  });
});
