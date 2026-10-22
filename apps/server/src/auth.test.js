import { Writable } from 'node:stream';
import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import pino from 'pino';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { redactionPaths } from './logger.js';
import {
  Merchant,
  OtpRequest,
  RefreshToken,
  AuditLog,
  AuthRateBucket,
  ensureCoreIndexes,
} from './models.js';
import { resolvePincode } from './regions.js';

let mongo, app, config, now, delivered, output;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24' }, replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'auth-integration' });
  await ensureCoreIndexes();
}, 180_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all(
    [Merchant, OtpRequest, RefreshToken, AuditLog, AuthRateBucket].map((model) =>
      model.deleteMany({}),
    ),
  );
  delivered = [];
  output = '';
  now = new Date();
  config = loadConfig({
    NODE_ENV: 'test',
    MONGO_URI: mongo.getUri(),
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    PHONE_HMAC_SECRET: 'c'.repeat(40),
    PHONE_ENC_KEY: 'd'.repeat(64),
    RECO_API_KEY: 'e'.repeat(40),
    ALLOW_DEV_OTP: 'true',
  });
  const sink = new Writable({
    write(chunk, _encoding, done) {
      output += chunk.toString();
      done();
    },
  });
  app = createApp({
    config,
    clock: () => now,
    smsProvider: {
      async send(message) {
        delivered.push(message);
      },
    },
    logger: pino({ level: 'info', redact: { paths: redactionPaths, censor: '[REDACTED]' } }, sink),
  });
});
const phone = '+919876543210';
function post(path, body = {}, token) {
  const call = request(app).post(`/api/v1${path}`).set('x-kirana-client', 'web');
  if (token) call.set('authorization', `Bearer ${token}`);
  return call.send(body);
}
async function login(number = phone) {
  await post('/auth/otp/request', { phone: number }).expect(202);
  return post('/auth/otp/verify', { phone: number, code: delivered.at(-1).code }).expect(200);
}
function refreshCookie(response) {
  return response.headers['set-cookie'][0].split(';')[0];
}
function put(path, body, token) {
  return request(app)
    .put(`/api/v1${path}`)
    .set('x-kirana-client', 'web')
    .set('authorization', `Bearer ${token}`)
    .send(body);
}
function me(token) {
  return request(app).get('/api/v1/merchants/me').set('authorization', `Bearer ${token}`);
}

it('signs in without revealing a phone, hashes OTPs, and never logs credentials', async () => {
  const result = await login();
  expect(result.body.merchant.phone).toBeUndefined();
  expect(result.body.expiresIn).toBe(900);
  expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
  expect(result.headers['set-cookie'][0]).toContain('SameSite=Lax');
  const stored = await OtpRequest.findOne();
  expect(stored.codeHash).toMatch(/^[a-f0-9]{32}:[a-f0-9]{64}$/);
  expect(stored.usedAt).toBeTruthy();
  expect(await AuditLog.countDocuments({ action: 'login' })).toBe(1);
  for (const value of [phone, '123456', result.body.accessToken, refreshCookie(result)])
    expect(output).not.toContain(value);
  await post('/auth/otp/verify', { phone, code: '123456' }).expect(401);
});

it('commits incorrect attempt counts, caps them at five, and rejects a later correct code', async () => {
  await post('/auth/otp/request', { phone }).expect(202);
  for (let i = 0; i < 5; i++) await post('/auth/otp/verify', { phone, code: '000000' }).expect(401);
  await post('/auth/otp/verify', { phone, code: '123456' }).expect(401);
  expect((await OtpRequest.findOne()).attempts).toBe(5);
});

it('rejects expired codes even before Mongo TTL removes them', async () => {
  await post('/auth/otp/request', { phone }).expect(202);
  now = new Date(now.getTime() + 300_001);
  await post('/auth/otp/verify', { phone, code: '123456' }).expect(401);
});

it('enforces the three-request phone/IP window across app instances', async () => {
  for (let i = 0; i < 3; i++) await post('/auth/otp/request', { phone }).expect(202);
  app = createApp({
    config,
    clock: () => now,
    logger: pino({ level: 'silent' }),
    smsProvider: {
      async send(message) {
        delivered.push(message);
      },
    },
  });
  now = new Date(now.getTime() + 599_999);
  await post('/auth/otp/request', { phone: '+919876543211' }).expect(429);
  expect(delivered).toHaveLength(3);
  now = new Date(now.getTime() + 2);
  await post('/auth/otp/request', { phone }).expect(202);
});

it('rotates refresh cookies; replay revokes the family including the new access token', async () => {
  const first = await login();
  const old = refreshCookie(first);
  const next = await post('/auth/refresh').set('Cookie', old).expect(200);
  expect(refreshCookie(next)).not.toBe(old);
  await me(next.body.accessToken).expect(200);
  await post('/auth/refresh').set('Cookie', old).expect(401);
  await post('/auth/refresh').set('Cookie', refreshCookie(next)).expect(401);
  await me(next.body.accessToken).expect(401);
  expect(await AuditLog.countDocuments({ action: 'token_reuse' })).toBe(1);
});

it('makes simultaneous OTP verification single use', async () => {
  await post('/auth/otp/request', { phone }).expect(202);
  const responses = await Promise.all([
    post('/auth/otp/verify', { phone, code: '123456' }),
    post('/auth/otp/verify', { phone, code: '123456' }),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
  expect(await Merchant.countDocuments()).toBe(1);
});

it('resumes ordered onboarding, derives region on the server, and normalises UPI', async () => {
  const result = await login();
  const token = result.body.accessToken;
  await put(
    '/merchants/me/store',
    { storeName: 'Test shop', ownerName: 'Test merchant' },
    token,
  ).expect(409);
  await put(
    '/merchants/me/language',
    { uiLanguage: 'hi-IN', voiceLanguage: 'en-IN', voicePreference: 'male' },
    token,
  ).expect(200);
  await put(
    '/merchants/me/store',
    { storeName: 'Test shop', ownerName: 'Test merchant' },
    token,
  ).expect(200);
  await put('/merchants/me/location', { pincode: '122001', regionId: 'forged' }, token).expect(400);
  const location = await put(
    '/merchants/me/location',
    { pincode: '122001', coarseLat: 28.45999, coarseLng: 77.01999 },
    token,
  ).expect(200);
  expect(location.body.merchant.location).toMatchObject({
    regionId: 'haryana:gurugram',
    coarseLat: 28.46,
    coarseLng: 77.02,
  });
  const restored = await post('/auth/refresh').set('Cookie', refreshCookie(result)).expect(200);
  expect(restored.body.merchant.onboardingStep).toBe(3);
  const complete = await put(
    '/merchants/me/upi',
    { vpa: ' TEST.SHOP@UPI ', displayName: 'Test shop' },
    restored.body.accessToken,
  ).expect(200);
  expect(complete.body.merchant).toMatchObject({
    onboardingStep: 4,
    status: 'active',
    upi: { vpa: 'test.shop@upi' },
  });
  expect(await AuditLog.countDocuments({ action: 'language_change' })).toBe(1);
  expect(await AuditLog.countDocuments({ action: 'upi_change' })).toBe(1);
  expect(resolvePincode('100000').location.regionId).toBe('pin:100');
});

it('validates CSRF, injected operators, unknown queries, UPI and QR bytes', async () => {
  await request(app).post('/api/v1/auth/otp/request').send({ phone }).expect(403);
  await post('/auth/otp/request', { phone: { $gt: '' } }).expect(400);
  const result = await login();
  const token = result.body.accessToken;
  await request(app)
    .get('/api/v1/merchants/me?merchantId=someone')
    .set('authorization', `Bearer ${token}`)
    .expect(400);
  for (const [path, body] of [
    ['language', { uiLanguage: 'en-IN', voiceLanguage: 'hi-IN' }],
    ['store', { storeName: 'Test', ownerName: 'Test' }],
    ['location', { pincode: '110001' }],
  ])
    await put(`/merchants/me/${path}`, body, token).expect(200);
  await put('/merchants/me/upi', { vpa: 'invalid', displayName: 'Test' }, token).expect(400);
  await post(
    '/merchants/me/qr',
    { imageDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' },
    token,
  ).expect(400);
  const imageDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVn8AAAAASUVORK5CYII=';
  const saved = await post('/merchants/me/qr', { imageDataUrl }, token).expect(200);
  expect(saved.body.merchant.upi.qrImageDataUrl).toBe(imageDataUrl);
});

it('logs out the current family or all merchant devices and rejects expired access', async () => {
  const first = await login();
  const second = await login();
  await post('/auth/logout', {}, first.body.accessToken).expect(204);
  await me(first.body.accessToken).expect(401);
  await me(second.body.accessToken).expect(200);
  const third = await login();
  await post('/auth/logout-all', {}, second.body.accessToken).expect(204);
  await me(third.body.accessToken).expect(401);
  expect(await RefreshToken.countDocuments({ expiresAt: { $gt: now } })).toBe(0);
});

it('expires access at fifteen minutes while allowing a valid refresh', async () => {
  const first = await login();
  now = new Date(now.getTime() + 900_001);
  await me(first.body.accessToken).expect(401);
  const renewed = await post('/auth/refresh').set('Cookie', refreshCookie(first)).expect(200);
  await me(renewed.body.accessToken).expect(200);
});

it('persists only the authenticated merchant settings and rejects ownership injection', async () => {
  const first = await login();
  const second = await login('+919876543211');
  const response = await request(app)
    .patch('/api/v1/merchants/me')
    .set('x-kirana-client', 'web')
    .set('authorization', `Bearer ${first.body.accessToken}`)
    .send({ settings: { theme: 'day', closingHour: 21 } })
    .expect(200);
  expect(response.body.merchant.settings).toMatchObject({ theme: 'day', closingHour: 21 });
  await request(app)
    .patch('/api/v1/merchants/me')
    .set('x-kirana-client', 'web')
    .set('authorization', `Bearer ${first.body.accessToken}`)
    .send({ merchantId: second.body.merchant.id, settings: { theme: 'day' } })
    .expect(400);
  expect((await me(second.body.accessToken)).body.merchant.settings.theme).toBe('dark');
});

it('refuses fixed OTP in production and unconfigured SMS does not pretend delivery', async () => {
  expect(() =>
    loadConfig({
      ...config,
      CORS_ORIGINS: config.CORS_ORIGINS.join(','),
      COOKIE_SECURE: 'false',
      NODE_ENV: 'production',
      ALLOW_DEV_OTP: 'true',
    }),
  ).toThrow('ALLOW_DEV_OTP');
  app = createApp({
    config: { ...config, ALLOW_DEV_OTP: false },
    logger: pino({ level: 'silent' }),
  });
  await post('/auth/otp/request', { phone }).expect(503);
  expect(await OtpRequest.countDocuments()).toBe(0);
});
