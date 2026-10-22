import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { otpRequestSchema, otpVerifySchema } from '@kirana/shared/merchant';
import { Merchant, OtpRequest, RefreshToken, AuditLog, AuthRateBucket } from './models.js';
import { problem, validateRequest } from './http.js';
import { createSmsProvider } from './sms.js';

const scrypt = promisify(scryptCallback);
const refreshDays = 30 * 24 * 60 * 60 * 1000;
const cookieName = 'kirana_refresh';
export async function hashOtp(code, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${(await scrypt(code, salt, 32)).toString('hex')}`;
}
async function matches(code, hash) {
  const [salt, expected] = hash.split(':');
  const actual = (await hashOtp(code, salt)).split(':')[1];
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
export function publicMerchant(merchant) {
  const result = merchant.toObject ? merchant.toObject() : { ...merchant };
  delete result.phone;
  delete result.__v;
  return { ...result, id: String(result._id), _id: undefined };
}
export function createAuth({
  config,
  logger,
  smsProvider = createSmsProvider(config, logger),
  clock = () => new Date(),
}) {
  const router = Router();
  const hash = (value) =>
    createHmac('sha256', config.JWT_REFRESH_SECRET).update(value).digest('hex');
  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production' || config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE || 'lax',
    path: '/api/v1/auth',
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  };
  function cookie(req) {
    return req.headers.cookie?.match(/(?:^|;\s*)kirana_refresh=([a-f0-9]{96})(?:;|$)/)?.[1];
  }
  function audit(req, action, merchantId, session) {
    return AuditLog.create(
      [{ merchantId, action, meta: {}, ip: req.ip, requestId: req.id, at: clock() }],
      { session },
    );
  }
  function access(merchantId, family) {
    return jwt.sign(
      { family, iat: Math.floor(clock().getTime() / 1000) },
      config.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        subject: String(merchantId),
        issuer: 'kirana-api',
        audience: 'kirana-client',
        expiresIn: 900,
      },
    );
  }
  async function newRefresh(req, merchantId, family, session) {
    const raw = randomBytes(48).toString('hex');
    const tokenHash = hash(raw);
    await RefreshToken.create(
      [
        {
          merchantId,
          family,
          tokenHash,
          expiresAt: new Date(clock().getTime() + refreshDays),
          ip: req.ip,
          userAgent: (req.get('user-agent') || '').slice(0, 300),
        },
      ],
      { session },
    );
    return { raw, tokenHash };
  }
  function sendSession(res, merchant, family, raw) {
    res.cookie(cookieName, raw, { ...cookieOptions, maxAge: refreshDays });
    res.json({
      accessToken: access(merchant._id, family),
      expiresIn: 900,
      merchant: publicMerchant(merchant),
    });
  }
  async function authenticate(req, _res, next) {
    try {
      if (mongoose.connection.readyState !== 1) throw problem(503, 'DATABASE_UNAVAILABLE');
      const token = req.get('authorization')?.match(/^Bearer ([\w.-]+)$/)?.[1];
      if (!token) throw problem(401, 'UNAUTHENTICATED');
      let payload;
      try {
        payload = jwt.verify(token, config.JWT_ACCESS_SECRET, {
          algorithms: ['HS256'],
          issuer: 'kirana-api',
          audience: 'kirana-client',
          clockTimestamp: Math.floor(clock().getTime() / 1000),
        });
      } catch {
        throw problem(401, 'UNAUTHENTICATED');
      }
      if (!mongoose.isObjectIdOrHexString(payload.sub) || typeof payload.family !== 'string')
        throw problem(401, 'UNAUTHENTICATED');
      const active = await RefreshToken.exists({
        merchantId: payload.sub,
        family: payload.family,
        replacedBy: null,
        expiresAt: { $gt: clock() },
      });
      const merchant = active && (await Merchant.findById(payload.sub));
      if (!merchant || merchant.status === 'suspended') throw problem(401, 'UNAUTHENTICATED');
      req.merchant = merchant;
      req.tokenFamily = payload.family;
      next();
    } catch (error) {
      next(error);
    }
  }
  const limit = rateLimit({
    windowMs: 600_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(problem(429, 'RATE_LIMITED')),
  });
  router.use(limit, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use((req, _res, next) => {
    if (req.path !== '/capabilities' && mongoose.connection.readyState !== 1)
      return next(problem(503, 'DATABASE_UNAVAILABLE'));
    next();
  });
  router.get('/capabilities', (req, res) => {
    validateRequest(req);
    res.json({
      developmentOtp:
        config.NODE_ENV !== 'production' &&
        config.ALLOW_DEV_OTP &&
        config.SMS_PROVIDER === 'console',
    });
  });
  router.post('/otp/request', async (req, res) => {
    const { body } = validateRequest(req, otpRequestSchema);
    const now = clock();
    // Atomic rolling windows are shared by API processes; IPv6 limits use a subnet.
    for (const subject of [`phone:${body.phone}`, `ip:${ipKeyGenerator(req.ip)}`]) {
      const filter = { _id: hash(subject) };
      const pipeline = [
        {
          $set: {
            events: {
              $filter: {
                input: { $ifNull: ['$events', []] },
                as: 'at',
                cond: { $gt: ['$$at', new Date(now.getTime() - 600_000)] },
              },
            },
          },
        },
        {
          $set: {
            allowed: { $lt: [{ $size: '$events' }, 3] },
            expiresAt: new Date(now.getTime() + 600_000),
            createdAt: { $ifNull: ['$createdAt', now] },
            updatedAt: now,
          },
        },
        {
          $set: {
            events: { $cond: ['$allowed', { $concatArrays: ['$events', [now]] }, '$events'] },
          },
        },
      ];
      let bucket;
      try {
        bucket = await AuthRateBucket.findOneAndUpdate(filter, pipeline, {
          upsert: true,
          new: true,
          timestamps: false,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        bucket = await AuthRateBucket.findOneAndUpdate(filter, pipeline, {
          new: true,
          timestamps: false,
        });
      }
      if (!bucket?.allowed) throw problem(429, 'RATE_LIMITED');
    }
    const code =
      config.NODE_ENV !== 'production' && config.ALLOW_DEV_OTP
        ? '123456'
        : String(randomInt(100_000, 1_000_000));
    // Delivery failures return an honest error; no unusable OTP is persisted.
    await smsProvider.send({ phone: body.phone, code, timeoutMs: 5000 });
    await OtpRequest.create({
      phone: body.phone,
      codeHash: await hashOtp(code),
      expiresAt: new Date(now.getTime() + 300_000),
      ip: req.ip,
    });
    res.status(202).json({ messageKey: 'auth.otpSent', expiresIn: 300 });
  });
  router.post('/otp/verify', async (req, res) => {
    const { body } = validateRequest(req, otpVerifySchema);
    const result = await mongoose.connection.transaction(async (session) => {
      const otp = await OtpRequest.findOne({ phone: body.phone })
        .sort({ createdAt: -1 })
        .session(session);
      if (!otp || otp.usedAt || otp.expiresAt <= clock() || otp.attempts >= 5) return null;
      otp.attempts += 1;
      const valid = await matches(body.code, otp.codeHash);
      if (valid) otp.usedAt = clock();
      await otp.save({ session });
      if (!valid) return null;
      const merchant = await Merchant.findOneAndUpdate(
        { phone: body.phone },
        { $setOnInsert: { phone: body.phone } },
        { upsert: true, new: true, session, setDefaultsOnInsert: true },
      );
      if (merchant.status === 'suspended') return null;
      const family = randomUUID();
      const token = await newRefresh(req, merchant._id, family, session);
      await audit(req, 'login', merchant._id, session);
      return { merchant, family, token };
    });
    if (!result) throw problem(401, 'OTP_INVALID');
    sendSession(res, result.merchant, result.family, result.token.raw);
  });
  router.post('/refresh', async (req, res) => {
    validateRequest(req);
    const raw = cookie(req);
    if (!raw) throw problem(401, 'UNAUTHENTICATED');
    const result = await mongoose.connection.transaction(async (session) => {
      const token = await RefreshToken.findOne({ tokenHash: hash(raw) }).session(session);
      if (!token || token.expiresAt <= clock()) return null;
      if (token.replacedBy) {
        await RefreshToken.updateMany(
          { family: token.family },
          { $set: { expiresAt: clock() } },
          { session },
        );
        await audit(req, 'token_reuse', token.merchantId, session);
        return null;
      }
      const merchant = await Merchant.findById(token.merchantId).session(session);
      if (!merchant || merchant.status === 'suspended') return null;
      const next = await newRefresh(req, merchant._id, token.family, session);
      token.replacedBy = next.tokenHash;
      await token.save({ session });
      return { merchant, family: token.family, raw: next.raw };
    });
    if (!result) {
      res.clearCookie(cookieName, cookieOptions);
      throw problem(401, 'UNAUTHENTICATED');
    }
    sendSession(res, result.merchant, result.family, result.raw);
  });
  for (const all of [false, true])
    router.post(all ? '/logout-all' : '/logout', authenticate, async (req, res) => {
      validateRequest(req);
      await RefreshToken.updateMany(
        all ? { merchantId: req.merchant._id } : { family: req.tokenFamily },
        { $set: { expiresAt: clock() } },
      );
      await audit(req, all ? 'logout_all' : 'logout', req.merchant._id);
      res.clearCookie(cookieName, cookieOptions).status(204).end();
    });
  return { router, authenticate, audit };
}
