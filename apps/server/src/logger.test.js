import { Writable } from 'node:stream';
import { expect, it } from 'vitest';
import pino from 'pino';
import { redactionPaths } from './logger.js';

it('redacts secrets and private fields from structured logs', () => {
  let output = '';
  const sink = new Writable({
    write(chunk, _encoding, done) {
      output += chunk.toString();
      done();
    },
  });
  const logger = pino({ redact: { paths: redactionPaths, censor: '[REDACTED]' } }, sink);
  logger.info({
    phone: 'private-phone',
    otp: 'private-otp',
    req: {
      headers: { authorization: 'private-token', cookie: 'private-cookie' },
      body: { phone: 'body-phone' },
    },
  });
  for (const value of [
    'private-phone',
    'private-otp',
    'private-token',
    'private-cookie',
    'body-phone',
  ])
    expect(output).not.toContain(value);
  expect(output).toContain('[REDACTED]');
});
