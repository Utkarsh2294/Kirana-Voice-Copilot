// Isolated software-test server: never contacts a speech vendor or sends an SMS.
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../apps/server/src/app.js';
import { loadConfig } from '../apps/server/src/config.js';
import { createLogger } from '../apps/server/src/logger.js';
import { Merchant, ensureCoreIndexes } from '../apps/server/src/models.js';
import { ensureVoiceIndexes } from '../apps/server/src/voice-models.js';
import { createVoicePlatform } from '../apps/server/src/voice-platform.js';

if (process.env.NODE_ENV === 'production') throw new Error('Test server cannot run in production');
const mongo = await MongoMemoryReplSet.create({
  binary: { version: '7.0.24' },
  replSet: { count: 1 },
});
await mongoose.connect(mongo.getUri(), { dbName: 'voice-browser-disposable' });
await ensureCoreIndexes();
await ensureVoiceIndexes();
await Merchant.create({
  phone: '+919000000999',
  storeName: 'Voice Test Kirana',
  ownerName: 'Test Merchant',
  uiLanguage: 'en-IN',
  voiceLanguage: 'en-IN',
  status: 'active',
  onboardingStep: 4,
  settings: { voiceVolume: 0.8 },
});
const config = loadConfig({
  MONGO_URI: mongo.getUri(),
  PORT: '3101',
  NODE_ENV: 'test',
  ALLOW_DEV_OTP: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  PHONE_HMAC_SECRET: 'c'.repeat(40),
  PHONE_ENC_KEY: 'd'.repeat(64),
  RECO_API_KEY: 'e'.repeat(40),
  SARVAM_API_KEY: 'controlled-provider-server-only',
  DAILY_VOICE_BUDGET: '10000',
  CORS_ORIGINS: 'http://localhost:5174',
});
const logger = createLogger({ level: 'silent' });
const responseAudio = readFileSync(
  new URL('../tests/browser/fixtures/welcome.wav', import.meta.url),
);
const platform = createVoicePlatform({
  config,
  logger,
  providers: {
    stt: {
      async streamTranscribe({ lang, onPartial, onFinal }) {
        return {
          write: () => onPartial({ text: 'One kilogram', lang: lang === 'auto' ? 'en-IN' : lang }),
          finish: () =>
            onFinal({ text: 'One kilogram of rice.', lang: lang === 'auto' ? 'en-IN' : lang }),
          abort: () => {},
        };
      },
      async transcribeChunk() {
        return { text: 'One kilogram of rice.', lang: 'en-IN' };
      },
    },
    tts: {
      async synthesize() {
        return { bytes: responseAudio, contentType: 'audio/wav', provider: 'sarvam' };
      },
      async streamSynthesize() {
        return { bytes: responseAudio, contentType: 'audio/wav', provider: 'sarvam' };
      },
    },
    fallback: { supports: () => false },
  },
});
const app = createApp({
  config,
  logger,
  voicePlatform: platform,
  isReady: async () => true,
  smsProvider: { send: async () => {} },
});
const server = app.listen(3101, '127.0.0.1');
platform.attach(server);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, async () => {
    platform.close();
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  });
