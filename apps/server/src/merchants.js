import { Router } from 'express';
import { z } from 'zod';
import {
  languageStepSchema,
  storeStepSchema,
  locationStepSchema,
  upiStepSchema,
  merchantPatchSchema,
  qrUploadSchema,
} from '@kirana/shared/merchant';
import { Merchant } from './models.js';
import { publicMerchant } from './auth.js';
import { problem, validateRequest, emptySchema } from './http.js';
import { resolvePincode, suggestPincode } from './regions.js';

export function validateQrImage(value) {
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/);
  if (!match) throw problem(400, 'INVALID_QR_IMAGE');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 300 * 1024 || bytes.toString('base64') !== match[2])
    throw problem(400, 'INVALID_QR_IMAGE');
  const valid =
    match[1] === 'png'
      ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
      : match[1] === 'jpeg'
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw problem(400, 'INVALID_QR_IMAGE');
  return value;
}

export function merchantRouter(auth) {
  const router = Router();
  router.use(auth.authenticate, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/me', (req, res) => {
    validateRequest(req);
    res.json({ merchant: publicMerchant(req.merchant) });
  });
  router.patch('/me', async (req, res) => {
    const { body } = validateRequest(req, merchantPatchSchema);
    const updates = Object.fromEntries(
      Object.entries(body.settings).map(([key, value]) => [`settings.${key}`, value]),
    );
    const merchant = await Merchant.findByIdAndUpdate(
      req.merchant._id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    res.json({ merchant: publicMerchant(merchant) });
  });
  for (const [step, schema, minimum, next] of [
    ['language', languageStepSchema, 0, 1],
    ['store', storeStepSchema, 1, 2],
    ['location', locationStepSchema, 2, 3],
    ['upi', upiStepSchema, 3, 4],
  ])
    router.put(`/me/${step}`, async (req, res) => {
      const { body } = validateRequest(req, schema);
      if (req.merchant.onboardingStep < minimum) throw problem(409, 'ONBOARDING_ORDER');
      const fields =
        step === 'location'
          ? { location: { ...body, ...resolvePincode(body.pincode).location } }
          : step === 'upi'
            ? { 'upi.vpa': body.vpa, 'upi.displayName': body.displayName }
            : body;
      const merchant = await Merchant.findOneAndUpdate(
        { _id: req.merchant._id, onboardingStep: { $gte: minimum } },
        {
          $set: { ...fields, ...(next === 4 ? { status: 'active' } : {}) },
          $max: { onboardingStep: next },
        },
        { new: true, runValidators: true },
      );
      if (!merchant) throw problem(409, 'ONBOARDING_ORDER');
      if (step === 'language' || step === 'upi')
        await auth.audit(req, `${step}_change`, merchant._id);
      res.json({ merchant: publicMerchant(merchant) });
    });
  router.post('/me/qr', async (req, res) => {
    const { body } = validateRequest(req, qrUploadSchema);
    if (req.merchant.onboardingStep < 3) throw problem(409, 'ONBOARDING_ORDER');
    const image = validateQrImage(body.imageDataUrl);
    const merchant = await Merchant.findByIdAndUpdate(
      req.merchant._id,
      { $set: { 'upi.qrImageDataUrl': image } },
      { new: true },
    );
    await auth.audit(req, 'upi_qr_change', merchant._id);
    res.json({ merchant: publicMerchant(merchant) });
  });
  return router;
}

export function regionRouter(auth) {
  const router = Router();
  router.use(auth.authenticate);
  router.get('/pincode', (req, res) => {
    const { query } = validateRequest(
      req,
      emptySchema,
      z.object({ pincode: z.string().regex(/^[1-9]\d{5}$/) }).strict(),
    );
    res.json(resolvePincode(query.pincode));
  });
  router.get('/suggest', (req, res) => {
    const { query } = validateRequest(
      req,
      emptySchema,
      z
        .object({
          lat: z.coerce.number().min(-90).max(90),
          lng: z.coerce.number().min(-180).max(180),
        })
        .strict(),
    );
    const suggestion = suggestPincode(
      Math.round(query.lat * 100) / 100,
      Math.round(query.lng * 100) / 100,
    );
    if (!suggestion) throw problem(404, 'PINCODE_NOT_FOUND');
    res.json(suggestion);
  });
  return router;
}
