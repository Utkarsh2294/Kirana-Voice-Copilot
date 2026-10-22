import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { createLogger } from './logger.js';

export function createApp({ config, isReady = async () => false, logger = createLogger() }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const supplied = req.headers['x-request-id'];
        const id =
          typeof supplied === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(supplied)
            ? supplied
            : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        if (!origin || config.CORS_ORIGINS.includes(origin)) callback(null, true);
        else
          callback(
            Object.assign(new Error('Origin not allowed'), { status: 403, code: 'ORIGIN_DENIED' }),
          );
      },
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, _res, next) =>
        next(Object.assign(new Error('Too many requests'), { status: 429, code: 'RATE_LIMITED' })),
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'api' }));
  app.get('/readyz', async (req, res) => {
    let ready = false;
    try {
      ready = await isReady();
    } catch {
      req.log.warn({ code: 'MONGO_UNAVAILABLE' }, 'Readiness check failed');
    }
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'ready' : 'not-ready', checks: { mongo: Boolean(ready) } });
  });
  app.get('/api/v1', (_req, res) =>
    res.json({ name: 'Kirana Voice Copilot', version: '0.2.0', phase: 2 }),
  );
  app.use((_req, _res, next) =>
    next(Object.assign(new Error('Route not found'), { status: 404, code: 'NOT_FOUND' })),
  );
  app.use((error, req, res, _next) => {
    const status = error.status >= 400 && error.status < 600 ? error.status : 500;
    const code =
      error.code ||
      (status === 400 ? 'INVALID_JSON' : status === 413 ? 'BODY_TOO_LARGE' : 'INTERNAL_ERROR');
    req.log.error({ code, status, requestId: req.id }, 'Request failed');
    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `urn:kirana:problem:${code.toLowerCase()}`,
        title:
          status === 500
            ? 'Internal server error'
            : status === 400
              ? 'Invalid request'
              : status === 404
                ? 'Not found'
                : 'Request rejected',
        status,
        code,
        messageKey: `errors.${code}`,
        requestId: req.id,
      });
  });
  return app;
}
