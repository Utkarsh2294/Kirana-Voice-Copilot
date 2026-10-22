import { expect, it } from 'vitest';
import { loadConfig } from './config.js';

const env = {
  MONGO_URI: 'mongodb://localhost/test',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  PHONE_HMAC_SECRET: 'c'.repeat(32),
  PHONE_ENC_KEY: 'a'.repeat(64),
  RECO_API_KEY: 'd'.repeat(32),
};
it('names missing variables without printing any values', () => {
  expect(() => loadConfig({ ...env, JWT_ACCESS_SECRET: undefined })).toThrow('JWT_ACCESS_SECRET');
  expect(() => loadConfig({ ...env, RECO_API_KEY: 'secret-value' })).not.toThrow('secret-value');
});
it('validates booleans and production cookie/OTP safety', () => {
  expect(loadConfig(env).ALLOW_DEV_OTP).toBe(false);
  expect(() => loadConfig({ ...env, NODE_ENV: 'production', ALLOW_DEV_OTP: 'true' })).toThrow(
    'ALLOW_DEV_OTP',
  );
  expect(() => loadConfig({ ...env, COOKIE_SAME_SITE: 'none' })).toThrow('COOKIE_SECURE');
  expect(() => loadConfig({ ...env, ALLOW_DEV_OTP: 'yes' })).toThrow();
});
