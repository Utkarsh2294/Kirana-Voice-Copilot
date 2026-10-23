import { randomUUID } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { createLogger } from './logger.js';
import mongoSanitize from 'express-mongo-sanitize';
import { createAuth } from './auth.js';
import { merchantRouter, regionRouter } from './merchants.js';
import { problem } from './http.js';
import { createPricingService } from './pricing-service.js';
import { createMarketJobs } from './market-feeds.js';
import { createVoicePlatform } from './voice-platform.js';
import { pricingRouter } from './pricing-routes.js';
import { catalogRouter } from './catalog-routes.js';

export function createApp({
  config,
  isReady = async () => false,
  logger = createLogger(),
  smsProvider,
  clock,
  pricingService,
  marketJobs,
  voicePlatform,
}) {
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
  app.use('/api/v1/merchants/me/qr', express.json({ limit: '410kb' }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/v1', (req, _res, next) => {
    // Express 5 query is a getter: use the package's object API, not its assigning middleware.
    if ([req.body, req.query, req.params].some((value) => value && mongoSanitize.has(value)))
      return next(problem(400, 'VALIDATION_FAILED'));
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-kirana-client') !== 'web')
      return next(problem(403, 'CSRF_REJECTED'));
    next();
  });
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
    res.json({ name: 'Kirana Voice Copilot', version: '0.2.0', phase: 6 }),
  );
  const pricing = pricingService || createPricingService({ config });
  const jobs = marketJobs || createMarketJobs({ config, pricing, logger });
  const auth = createAuth({ config, logger, smsProvider, clock });
  const voice = voicePlatform || createVoicePlatform({ config, logger });
  app.locals.voice = voice;
  app.use('/api/v1/auth', auth.router);
  app.use('/api/v1/voice', voice.router(auth));
  app.use('/api/v1/merchants', merchantRouter(auth));
  app.use('/api/v1/regions', regionRouter(auth));
  app.use('/api/v1', pricingRouter(auth, { config, pricing, jobs }));
  app.use('/api/v1', catalogRouter(auth, undefined, pricing));
  app.use((_req, _res, next) =>
    next(Object.assign(new Error('Route not found'), { status: 404, code: 'NOT_FOUND' })),
  );
  app.use((error, req, res, _next) => {
    const status = error.status >= 400 && error.status < 600 ? error.status : 500;
    const code =
      (typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : null) ||
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
