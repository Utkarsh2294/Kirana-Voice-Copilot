import { z } from 'zod';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const secret = z.string().min(32);
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    MONGO_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//, 'must be a MongoDB connection URI'),
    JWT_ACCESS_SECRET: secret,
    JWT_REFRESH_SECRET: secret,
    PHONE_HMAC_SECRET: secret,
    PHONE_ENC_KEY: z.string().regex(/^[a-f\d]{64}$/i, 'must contain 64 hex characters'),
    RECO_API_KEY: secret,
    RECO_URL: z.url().default('http://localhost:8000'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(z.array(z.url()).min(1)),
    COOKIE_DOMAIN: z.string().default(''),
    COOKIE_SECURE: flag,
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    ALLOW_DEV_OTP: flag,
    SMS_PROVIDER: z.enum(['console', 'msg91', 'twilio']).default('console'),
    SARVAM_API_KEY: z.string().default(''),
    SARVAM_BASE_URL: z.url().default('https://api.sarvam.ai'),
    PAYMENT_PROVIDER: z.enum(['manual', 'demo', 'paytm-dqr']).default('demo'),
    MARKET_FEED: z.enum(['agmarknet', 'crowd', 'simulated', 'off']).default('simulated'),
    DATA_GOV_IN_API_KEY: z.string().default(''),
    DATA_GOV_IN_RESOURCE_ID: z.string().uuid().default('9ef84268-d588-465a-a308-a864a43d0070'),
    PRICING_ADMIN_MERCHANT_IDS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().regex(/^[a-f\d]{24}$/i))),
    MARKET_JOBS_ENABLED: flag,
    FEATURE_FLAGS: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.ALLOW_DEV_OTP)
      ctx.addIssue({
        code: 'custom',
        path: ['ALLOW_DEV_OTP'],
        message: 'must be false in production',
      });
    if (env.COOKIE_SAME_SITE === 'none' && !env.COOKIE_SECURE)
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'must be true for SameSite=None',
      });
  });

export function loadConfig(env = process.env) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Values are deliberately omitted: errors must never disclose secrets.
    throw new Error(
      `Invalid environment:\n${result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n')}`,
    );
  }
  return result.data;
}
