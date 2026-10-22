import pino from 'pino';

export const redactionPaths = [
  'phone',
  'otp',
  'authorization',
  'cookie',
  'token',
  'password',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.phone',
  '*.otp',
  '*.authorization',
  '*.cookie',
  '*.token',
  'req.body',
  'body',
  'config',
];

export function createLogger(options = {}) {
  return pino({
    level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: { paths: redactionPaths, censor: '[REDACTED]' },
    ...options,
  });
}
