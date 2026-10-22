import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { catalogItemSchema } from '@kirana/shared/catalog';
import { createApp } from './app.js';
import { createLogger } from './logger.js';
import { loadConfig } from './config.js';
import { Merchant, RefreshToken, ensureCoreIndexes } from './models.js';
import {
  CatalogItem,
  MerchantItem,
  CatalogNomination,
  ensureCatalogIndexes,
} from './catalog-models.js';
import { catalogService } from './catalog-service.js';

const seed = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url), 'utf8'));
const rice = seed.find((item) => item.slug === 'rice');
let mongo, config, app, first, second;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24' }, replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'catalog-integration' });
  await ensureCoreIndexes();
  await ensureCatalogIndexes();
  await CatalogItem.insertMany(seed.map((item) => catalogItemSchema.parse(item)));
  await catalogService.reload();
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
    [MerchantItem, CatalogNomination, Merchant, RefreshToken].map((model) => model.deleteMany({})),
  );
  await mongoose.connection.db.collection('bills').deleteMany({});
  first = await account('+919000000001');
  second = await account('+919000000002');
  app = createApp({ config, logger: createLogger({ level: 'silent' }) });
});
function call(method, path, body, token = first.token) {
  const target = request(app);
  const action = target[method](`/api/v1${path}`)
    .set('authorization', `Bearer ${token}`)
    .set('x-kirana-client', 'web');
  return body === undefined ? action : action.send(body);
}

it('serves 758 coherent draft items with eleven named languages and all required categories', async () => {
  const response = await call('get', '/merchant-items').expect(200);
  expect(response.body.items).toHaveLength(758);
  const categories = await call('get', '/catalog/categories').expect(200);
  expect(categories.body.categories).toHaveLength(13);
  expect(categories.body.categories.reduce((sum, row) => sum + row.count, 0)).toBe(758);
  expect(
    seed.every(
      (item) =>
        Object.keys(item.names).length === 11 &&
        Object.values(item.nameReview).every((status) => status === 'machine'),
    ),
  ).toBe(true);
  expect(seed.some((item) => /tobacco|cigarette|beer|whisky/i.test(item.names.en))).toBe(false);
  expect((await call('get', `/catalog/items/${rice._id}`)).body.item.priceSource).toBe('demo');
});
it('returns rice first for English, Hindi, Hinglish, prefix and typo searches', async () => {
  for (const query of ['rice', 'चावल', 'chawal', 'chaaw', 'chawel', 'அரிசி']) {
    const response = await call(
      'get',
      `/catalog/search?q=${encodeURIComponent(query)}&lang=en-IN&limit=5`,
    ).expect(200);
    expect(response.body.items[0].id, query).toBe(rice._id);
  }
});
it('persists favourites, hide, quantity-unit preference, own price and cost without touching another store', async () => {
  await call('put', `/merchant-items/${rice._id}`, {
    favourite: true,
    unit: 'g',
    savedPricePaise: 6300,
    costPricePaise: 5100,
  }).expect(200);
  const own = (await call('get', `/catalog/items/${rice._id}`)).body.item;
  expect(own).toMatchObject({
    favourite: true,
    unit: 'g',
    priceUnit: 'kg',
    unitSize: 1000,
    pricePaise: 6300,
    costPricePaise: 5100,
    priceSource: 'merchant',
  });
  const other = (await call('get', `/catalog/items/${rice._id}`, undefined, second.token)).body
    .item;
  expect(other).toMatchObject({ favourite: false, pricePaise: 5200, priceSource: 'demo' });
  await call('put', `/merchant-items/${rice._id}`, { hidden: true }).expect(200);
  expect(
    (await call('get', '/merchant-items')).body.items.some((item) => item.id === rice._id),
  ).toBe(false);
  expect(
    (await call('get', '/merchant-items?includeHidden=true')).body.items.find(
      (item) => item.id === rice._id,
    ).hidden,
  ).toBe(true);
  expect(
    (await call('get', '/catalog/search?q=rice')).body.items.some((item) => item.id === rice._id),
  ).toBe(false);
  await call('put', `/merchant-items/${rice._id}`, {
    hidden: false,
    savedPricePaise: null,
    costPricePaise: null,
  }).expect(200);
  expect((await call('get', `/catalog/items/${rice._id}`)).body.item).toMatchObject({
    pricePaise: 5200,
    priceSource: 'demo',
    costPricePaise: null,
  });
});

it('preserves simultaneous first-time updates to the same merchant catalog item', async () => {
  const responses = await Promise.all([
    call('put', `/merchant-items/${rice._id}`, { favourite: true }),
    call('put', `/merchant-items/${rice._id}`, { savedPricePaise: 7200 }),
  ]);
  expect(responses.map((response) => response.status)).toEqual([200, 200]);
  expect((await call('get', `/catalog/items/${rice._id}`)).body.item).toMatchObject({
    favourite: true,
    pricePaise: 7200,
  });
});
it('allows multiple custom items; isolates their updates, nominations, and deletion by owner', async () => {
  const created = await call('post', '/merchant-items/custom', {
    name: 'Test roasted grain',
    unit: 'kg',
    kind: 'loose',
    savedPricePaise: 7200,
    favourite: true,
  }).expect(201);
  await call('post', '/merchant-items/custom', {
    name: 'Test local snack',
    unit: 'pc',
    kind: 'packed',
    savedPricePaise: 1500,
  }).expect(201);
  const id = created.body.item.id;
  expect((await call('get', '/merchant-items')).body.items).toHaveLength(760);
  expect(
    (await call('get', '/catalog/search?q=roasted%20grain')).body.items.some(
      (item) => item.id === id,
    ),
  ).toBe(true);
  await call('put', `/merchant-items/${id}`, { savedPricePaise: 1 }, second.token).expect(404);
  await call('delete', `/merchant-items/${id}`, undefined, second.token).expect(404);
  await call('post', `/merchant-items/${id}/nominate`, {}, second.token).expect(404);
  await call('post', `/merchant-items/${id}/nominate`, {}).expect(202);
  await call('post', `/merchant-items/${id}/nominate`, {}).expect(202);
  expect(await CatalogNomination.countDocuments()).toBe(1);
  expect(await CatalogItem.countDocuments()).toBe(758);
  await call('delete', `/merchant-items/${id}`).expect(204);
  expect((await call('get', '/merchant-items')).body.items).toHaveLength(759);
  expect((await MerchantItem.findById(id)).deletedAt).toBeTruthy();
});
it('uses thirty-day paid-bill frequency, counts duplicate lines once, and ignores other stores and old bills', async () => {
  const tea = seed.find((item) => item.slug === 'tea');
  const docs = [
    {
      merchantId: first.merchant._id,
      createdAt: new Date(),
      payment: { status: 'paid' },
      lines: [
        { catalogItemId: new mongoose.Types.ObjectId(rice._id) },
        { catalogItemId: new mongoose.Types.ObjectId(rice._id) },
        { catalogItemId: new mongoose.Types.ObjectId(tea._id) },
      ],
    },
    {
      merchantId: first.merchant._id,
      createdAt: new Date(),
      payment: { status: 'paid' },
      lines: [{ catalogItemId: new mongoose.Types.ObjectId(tea._id) }],
    },
    {
      merchantId: second.merchant._id,
      createdAt: new Date(),
      payment: { status: 'paid' },
      lines: [{ catalogItemId: new mongoose.Types.ObjectId(rice._id) }],
    },
    {
      merchantId: first.merchant._id,
      createdAt: new Date(Date.now() - 40 * 86400000),
      payment: { status: 'paid' },
      lines: [{ catalogItemId: new mongoose.Types.ObjectId(rice._id) }],
    },
  ];
  await mongoose.connection.db.collection('bills').insertMany(docs);
  const response = await call('get', '/catalog/frequent').expect(200);
  expect(response.body.basis).toBe('sales');
  expect(response.body.items.map((item) => item.id)).toEqual([tea._id, rice._id]);
  const snapshot = await call('get', '/merchant-items');
  expect(snapshot.body.items.find((item) => item.id === tea._id).salesFrequency30d).toBe(2);
  const other = await call('get', '/merchant-items', undefined, second.token);
  expect(other.body.items.find((item) => item.id === tea._id).salesFrequency30d).toBe(0);
});
it('validates ids, request operators, negative/fractional money, unsupported units and owner injection', async () => {
  await call('get', '/catalog/items/not-an-id').expect(400);
  for (const body of [
    { savedPricePaise: -1 },
    { savedPricePaise: 1.5 },
    { unit: 'L' },
    { merchantId: String(second.merchant._id) },
    { savedPricePaise: { $gt: 0 } },
  ])
    await call('put', `/merchant-items/${rice._id}`, body).expect(400);
  await call('get', '/catalog/search?q=rice&merchantId=other').expect(400);
  await call('get', '/catalog/search?q=rice&limit=999').expect(400);
  await call('delete', `/merchant-items/${rice._id}`).expect(404);
  await Merchant.updateOne(
    { _id: first.merchant._id },
    { $set: { onboardingStep: 2, status: 'onboarding' } },
  );
  await call('get', '/merchant-items').expect(403);
});
