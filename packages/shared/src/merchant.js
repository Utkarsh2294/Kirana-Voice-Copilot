import { z } from 'zod';
import { uiLanguageCodes } from './languages.js';

export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/);
export const otpRequestSchema = z.object({ phone: phoneSchema }).strict();
export const otpVerifySchema = otpRequestSchema.extend({ code: z.string().regex(/^\d{6}$/) });
export const languageStepSchema = z
  .object({
    uiLanguage: z.enum(uiLanguageCodes),
    voiceLanguage: z.enum(uiLanguageCodes),
    voicePreference: z.enum(['male', 'female']).default('female'),
  })
  .strict();
const name = z.string().trim().min(1).max(100);
export const storeStepSchema = z.object({ storeName: name, ownerName: name }).strict();
export const locationStepSchema = z
  .object({
    pincode: z.string().regex(/^[1-9]\d{5}$/),
    coarseLat: z
      .number()
      .min(-90)
      .max(90)
      .transform((value) => Math.round(value * 100) / 100)
      .optional(),
    coarseLng: z
      .number()
      .min(-180)
      .max(180)
      .transform((value) => Math.round(value * 100) / 100)
      .optional(),
  })
  .strict()
  .refine((value) => (value.coarseLat === undefined) === (value.coarseLng === undefined));
export const upiStepSchema = z
  .object({
    vpa: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9.-]{1,63}$/),
    displayName: name,
  })
  .strict();
export const merchantSettingsSchema = z
  .object({
    roundingMode: z.enum(['none', 'nearest-rupee']).optional(),
    announcePaymentOnWeb: z.boolean().optional(),
    readbackMode: z.enum(['silent', 'verbose']).optional(),
    haptics: z.boolean().optional(),
    earcons: z.boolean().optional(),
    theme: z.enum(['auto', 'dark', 'day']).optional(),
    closingHour: z.number().int().min(0).max(23).optional(),
    restockReviewDays: z.number().int().min(1).max(30).optional(),
    supplierLeadDays: z.number().int().min(0).max(90).optional(),
  })
  .strict();
export const merchantPatchSchema = z.object({ settings: merchantSettingsSchema }).strict();
export const qrUploadSchema = z.object({ imageDataUrl: z.string().max(410_000) }).strict();
