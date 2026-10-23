import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { Merchant, RefreshToken, AuthRateBucket, ensureCoreIndexes } from './models.js';
import {
  VoiceTicket,
  VoiceDaily,
  VoiceBillUsage,
  VoiceSample,
  ensureVoiceIndexes,
} from './voice-models.js';
import { CatalogItem } from './catalog-models.js';
import { createVoicePlatform } from './voice-platform.js';
import { speechCacheKey, createAudioCache } from './voice-cache.js';
import { wavFromPcm } from '@kirana/shared/audio';
import { voiceCapabilities } from '@kirana/shared/voice';

let mongo, config, app, platform, server, first, second, stt, tts, fallback, abort;
const logger = createLogger({ level: 'silent' }),
  origin = 'http://localhost:5173';
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ binary: { version: '7.0.24' }, replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: 'voice-integration' });
  await ensureCoreIndexes();
  await ensureVoiceIndexes();
}, 180000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
async function account(phone) {
  const merchant = await Merchant.create({
      phone,
      storeName: 'Voice test',
      onboardingStep: 4,
      status: 'active',
      voiceLanguage: 'en-IN',
    }),
    family = randomUUID();
  await RefreshToken.create({
    merchantId: merchant._id,
    family,
    tokenHash: randomUUID(),
    expiresAt: new Date(Date.now() + 86400000),
  });
  return {
    merchant,
    family,
    token: jwt.sign({ family }, config.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      issuer: 'kirana-api',
      audience: 'kirana-client',
      subject: String(merchant._id),
      expiresIn: 900,
    }),
  };
}
beforeEach(async () => {
  await Promise.all(
    [
      Merchant,
      RefreshToken,
      AuthRateBucket,
      VoiceTicket,
      VoiceDaily,
      VoiceBillUsage,
      VoiceSample,
      CatalogItem,
    ].map((model) => model.deleteMany({})),
  );
  for (const name of ['ttsAudio.files', 'ttsAudio.chunks'])
    await mongoose.connection.db.collection(name).deleteMany({});
  config = loadConfig({
    MONGO_URI: mongo.getUri(),
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    PHONE_HMAC_SECRET: 'c'.repeat(40),
    PHONE_ENC_KEY: 'd'.repeat(64),
    RECO_API_KEY: 'e'.repeat(40),
    NODE_ENV: 'test',
    SARVAM_API_KEY: 'server-only-test-secret',
    DAILY_VOICE_BUDGET: '10000',
  });
  first = await account('+919000000001');
  second = await account('+919000000002');
  abort = vi.fn();
  stt = {
    streamTranscribe: vi.fn(async ({ onPartial, onFinal, lang }) => ({
      write: () => onPartial({ text: 'One kilogram', lang: lang === 'auto' ? 'en-IN' : lang }),
      finish: () =>
        onFinal({ text: 'One kilogram of rice.', lang: lang === 'auto' ? 'en-IN' : lang }),
      abort,
    })),
    transcribeChunk: vi.fn(async () => ({ text: 'REST rice', lang: 'en-IN' })),
  };
  tts = {
    synthesize: vi.fn(async () => ({
      bytes: Buffer.from(wavFromPcm(new Uint8Array(6400))),
      contentType: 'audio/wav',
      provider: 'sarvam',
    })),
    streamSynthesize: vi.fn(async () => ({
      bytes: Buffer.from(wavFromPcm(new Uint8Array(6400))),
      contentType: 'audio/mpeg',
      provider: 'sarvam',
    })),
  };
  fallback = { supports: () => false, transcribeChunk: vi.fn(), synthesize: vi.fn() };
  platform = createVoicePlatform({ config, logger, providers: { stt, tts, fallback } });
  app = createApp({ config, logger, voicePlatform: platform });
  server = app.listen(0, '127.0.0.1');
  platform.attach(server);
  await once(server, 'listening');
});
afterEach(async () => {
  platform.close();
  await new Promise((resolve) => server.close(resolve));
});
function call(method, path, body, token = first.token) {
  const target = request(app);
  const action = target[method](`/api/v1/voice${path}`)
    .set('authorization', `Bearer ${token}`)
    .set('x-kirana-client', 'web');
  return body === undefined ? action : action.send(body);
}
async function connect(token, customOrigin = origin) {
  const socket = new WebSocket(
    `ws://127.0.0.1:${server.address().port}/ws/voice`,
    `kirana-voice.${token}`,
    { headers: { Origin: customOrigin } },
  );
  return socket;
}
const nextMessage = (socket, type) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Missing ${type} message`)), 5000);
    const listener = (data) => {
      const message = JSON.parse(data);
      if (message.type === type) {
        clearTimeout(timer);
        socket.off('message', listener);
        resolve(message);
      }
    };
    socket.on('message', listener);
  });

it('keeps capability, normalized cache keys and audio tenant separation explicit', async () => {
  const options = {
    text: '  नमस्ते   दुकान ',
    lang: 'hi-IN',
    voice: 'ishita',
    pace: 0.95,
    format: 'mp3',
  };
  expect(speechCacheKey(options)).toBe(speechCacheKey({ ...options, text: 'नमस्ते दुकान' }));
  expect(speechCacheKey(options)).not.toBe(speechCacheKey({ ...options, voice: 'shubh' }));
  const capabilities = await call('get', '/capabilities');
  expect(Object.keys(capabilities.body.languages)).toHaveLength(23);
  expect(capabilities.body.languages['as-IN'].configuredTts).toEqual([]);
  const firstPlay = await call('post', '/tts', options).expect(200);
  expect(firstPlay.headers['x-voice-cache']).toBe('miss');
  const secondPlay = await call('post', '/tts', options).expect(200);
  expect(secondPlay.headers['x-voice-cache']).toBe('hit');
  await call('post', '/tts', options, second.token).expect(200);
  expect(tts.synthesize).toHaveBeenCalledTimes(2);
  const cacheFile = await mongoose.connection.db.collection('ttsAudio.files').findOne();
  expect(cacheFile.filename).toMatch(/^[a-f\d]{64}$/);
  expect(JSON.stringify(cacheFile.metadata)).not.toContain('नमस्ते');
});
it('routes each documented output language and uses streaming synthesis for long text', async () => {
  for (const [lang, entry] of Object.entries(voiceCapabilities).filter(
    ([, entry]) => entry.tts.length,
  ))
    await call('post', '/tts', { text: `Test ${lang}`, lang, voice: entry.voices.female }).expect(
      200,
    );
  expect(tts.synthesize).toHaveBeenCalledTimes(11);
  await call('post', '/tts', { text: 'A sentence. '.repeat(60), lang: 'en-IN' }).expect(200);
  expect(tts.streamSynthesize).toHaveBeenCalledTimes(1);
  await call('post', '/tts', {
    text: 'A sentence. '.repeat(60),
    lang: 'en-IN',
    format: 'wav',
  }).expect(400);
});
it('uses single-use short-lived voice tickets and cleans upstream connections on finish/disconnect', async () => {
  const ticket = await call('post', '/token', { lang: 'auto', clientBillId: randomUUID() }).expect(
    200,
  );
  const socket = await connect(ticket.body.token),
    ready = nextMessage(socket, 'ready');
  await ready;
  const partial = nextMessage(socket, 'partial'),
    final = nextMessage(socket, 'final');
  socket.send(Buffer.alloc(6400));
  await partial;
  socket.send(JSON.stringify({ type: 'finish' }));
  expect(await final).toMatchObject({
    text: 'One kilogram of rice.',
    lang: 'en-IN',
    metrics: { audioMs: 200 },
  });
  await once(socket, 'close');
  expect(platform.connections.size).toBe(0);
  expect(abort).toHaveBeenCalled();
  const replay = await connect(ticket.body.token);
  const rejected = new Promise((resolve) =>
    replay.once('unexpected-response', (_req, response) => {
      response.resume();
      replay.terminate();
      resolve(response.statusCode);
    }),
  );
  replay.on('error', () => {});
  expect(await rejected).toBe(401);
  const another = await call('post', '/token', { lang: 'en-IN' });
  const disconnected = await connect(another.body.token);
  await nextMessage(disconnected, 'ready');
  disconnected.close();
  await once(disconnected, 'close');
  await vi.waitFor(() => expect(platform.connections.size).toBe(0));
});
it('falls back from unavailable streaming to REST and rejects oversized audio', async () => {
  stt.streamTranscribe.mockRejectedValue(new Error('Unavailable'));
  const ticket = await call('post', '/token', { lang: 'en-IN' }),
    socket = await connect(ticket.body.token);
  expect(await nextMessage(socket, 'ready')).toMatchObject({ mode: 'rest' });
  const final = nextMessage(socket, 'final');
  socket.send(Buffer.alloc(6400));
  socket.send(JSON.stringify({ type: 'finish' }));
  expect((await final).text).toBe('REST rice');
  await once(socket, 'close');
  const secondTicket = await call('post', '/token', { lang: 'en-IN' }),
    bad = await connect(secondTicket.body.token);
  await nextMessage(bad, 'ready');
  const error = nextMessage(bad, 'error');
  bad.send(Buffer.alloc(8002));
  expect((await error).code).toBe('VOICE_AUDIO_LIMIT');
  await once(bad, 'close');
});
it('uses configured Bhashini only after Sarvam fails and never exposes vendor credentials', async () => {
  tts.synthesize.mockRejectedValue(new Error('server-only-test-secret'));
  fallback.supports = () => true;
  fallback.synthesize.mockResolvedValue({
    bytes: Buffer.from(wavFromPcm(new Uint8Array(3200))),
    contentType: 'audio/wav',
    provider: 'bhashini',
  });
  const response = await call('post', '/tts', { text: 'Fallback sample', lang: 'hi-IN' }).expect(
    200,
  );
  expect(response.headers['x-voice-provider']).toBe('bhashini');
  expect(JSON.stringify(response.headers)).not.toContain(config.SARVAM_API_KEY);
  fallback.supports = () => false;
  const failure = await call('post', '/tts', {
    text: 'Different uncached text',
    lang: 'hi-IN',
  }).expect(503);
  expect(JSON.stringify(failure.body)).not.toContain(config.SARVAM_API_KEY);
});
it('enforces per-merchant utterance/budget limits and supports cache hits after the budget is spent', async () => {
  await call('post', '/tts', { text: 'Cached', lang: 'en-IN' }).expect(200);
  await VoiceDaily.updateMany(
    { merchantId: first.merchant._id },
    { $set: { spentPaise: config.DAILY_VOICE_BUDGET } },
  );
  await call('post', '/tts', { text: 'New text', lang: 'en-IN' }).expect(429);
  expect(
    (await call('post', '/tts', { text: 'Cached', lang: 'en-IN' }).expect(200)).headers[
      'x-voice-cache'
    ],
  ).toBe('hit');
  for (let i = 0; i < 6; i++) await call('post', '/token', { lang: 'en-IN' }).expect(200);
  await call('post', '/token', { lang: 'en-IN' }).expect(429);
  expect((await call('get', '/usage')).body.cacheHits).toBe(1);
  expect((await call('get', '/usage', undefined, second.token)).body.ttsRequests).toBe(0);
});
it('keeps transcript retention off by default and stores only an opted-in redacted sample', async () => {
  await platform.usage.anonymisedSample(first.merchant, 'Rahul 9876543210', 'en-IN');
  expect(await VoiceSample.countDocuments()).toBe(0);
  first.merchant.settings.voiceTranscriptOptIn = true;
  await CatalogItem.collection.insertOne({ names: { en: 'rice' }, aliases: [], active: true });
  await platform.usage.anonymisedSample(first.merchant, 'Rahul 9876543210 rice', 'en-IN');
  const sample = await VoiceSample.findOne().lean();
  expect(sample.text).toBe('[redacted] [number] rice');
  expect(sample.ownerHash).not.toContain(String(first.merchant._id));
});
it('bounds GridFS output cache with LRU eviction', async () => {
  const cache = createAudioCache({ maxBytes: 100 });
  const audio = { bytes: Buffer.alloc(60), contentType: 'audio/wav', provider: 'test' };
  await cache.put(first.merchant._id, 'first', audio);
  await cache.put(first.merchant._id, 'second', audio);
  expect(await cache.get(first.merchant._id, 'first')).toBeNull();
  expect((await cache.get(first.merchant._id, 'second')).bytes).toHaveLength(60);
});
it('records owner-verified device hits without charging cached characters again', async () => {
  const clientBillId = randomUUID();
  const firstReply = await call('post', '/tts', {
    text: 'Owned cached reply',
    lang: 'en-IN',
    clientBillId,
  }).expect(200);
  const body = { key: firstReply.headers['x-voice-key'], characters: 18, clientBillId };
  await call('post', '/cache-hit', body).expect(204);
  await call('post', '/cache-hit', body, second.token).expect(204);
  expect((await call('get', '/usage')).body).toMatchObject({
    cacheHits: 1,
    ttsCharacters: 18,
    spokenCharacters: 36,
  });
  expect((await call('get', '/usage', undefined, second.token)).body.cacheHits).toBe(0);
  const bill = await VoiceBillUsage.findOne({
    merchantId: first.merchant._id,
    clientBillId,
  }).lean();
  expect(bill.ttsCharacters).toBe(18);
  expect(bill.spokenCharacters).toBe(36);
});
it('physically sweeps expired generated audio while leaving input recordings absent', async () => {
  let now = new Date('2026-10-01T12:00:00Z');
  const cache = createAudioCache({ clock: () => now });
  await cache.put(first.merchant._id, 'expiry', {
    bytes: Buffer.alloc(60),
    contentType: 'audio/wav',
    provider: 'test',
  });
  now = new Date(+now + 8 * 86400000);
  await cache.sweep();
  expect(await cache.get(first.merchant._id, 'expiry')).toBeNull();
  expect(await mongoose.connection.db.collection('ttsAudio.files').countDocuments()).toBe(0);
  expect(
    (await mongoose.connection.db.listCollections().toArray()).some((row) =>
      /recordings|rawAudio/.test(row.name),
    ),
  ).toBe(false);
});
