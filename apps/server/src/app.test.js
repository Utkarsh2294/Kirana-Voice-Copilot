import { expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { createLogger } from './logger.js';
import { problemSchema } from '@kirana/shared/schemas';

const app = (isReady = async () => true) =>
  createApp({
    config: { CORS_ORIGINS: ['http://localhost:5173'] },
    isReady,
    logger: createLogger({ level: 'silent' }),
  });
it('separates process health from database readiness', async () => {
  await request(app()).get('/healthz').expect(200);
  await request(app()).get('/readyz').expect(200);
  await request(app(async () => false))
    .get('/readyz')
    .expect(503);
  await request(
    app(async () => {
      throw new Error('db unavailable');
    }),
  )
    .get('/readyz')
    .expect(503);
});
it('returns stable problems with request ids and security headers', async () => {
  const response = await request(app())
    .get('/missing')
    .set('x-request-id', 'test-request-123')
    .expect(404);
  expect(problemSchema.parse(response.body).code).toBe('NOT_FOUND');
  expect(response.body.requestId).toBe('test-request-123');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['x-powered-by']).toBeUndefined();
});
it('denies unknown origins and malformed JSON', async () => {
  await request(app()).get('/healthz').set('Origin', 'https://evil.example').expect(403);
  const response = await request(app())
    .post('/api/v1')
    .set('Content-Type', 'application/json')
    .send('{broken')
    .expect(400);
  expect(response.body.code).toBe('INVALID_JSON');
});
