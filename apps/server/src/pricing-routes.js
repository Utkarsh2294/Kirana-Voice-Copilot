import { Router } from 'express';
import { z } from 'zod';
import { objectIdSchema } from '@kirana/shared/catalog';
import { paiseSchema } from '@kirana/shared/schemas';
import { MarketPrice, PriceHistory, CommodityMapping, PricingJob } from './pricing-models.js';
import { CatalogItem } from './catalog-models.js';
import { updateMerchantItem } from './pricing-service.js';
import { problem, validateRequest, emptySchema } from './http.js';

const ids = z.array(objectIdSchema).min(1).max(100);
const params = z.object({ itemId: objectIdSchema }).strict();
const priceBody = z.union([
  z.object({ savedPricePaise: paiseSchema.nullable() }).strict(),
  z.object({ undoOf: objectIdSchema }).strict(),
]);
export function pricingRouter(auth, { pricing, jobs, config }) {
  const router = Router();
  router.use(auth.authenticate, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.merchant.onboardingStep < 4) return next(problem(403, 'ONBOARDING_REQUIRED'));
    next();
  });
  router.post('/pricing/resolve', async (req, res) => {
    const { body } = validateRequest(req, z.object({ itemIds: ids }).strict());
    res.json({ prices: await pricing.resolvePrices(req.merchant._id, [...new Set(body.itemIds)]) });
  });
  router.get('/pricing/market', async (req, res) => {
    const { query } = validateRequest(
      req,
      emptySchema,
      z
        .object({
          regionId: z.string().min(1).max(160),
          itemIds: z
            .string()
            .transform((value) => value.split(','))
            .pipe(ids),
        })
        .strict(),
    );
    if (query.regionId !== req.merchant.location?.regionId) throw problem(403, 'REGION_DENIED');
    const map = await pricing.marketFor(query.regionId);
    res.json({
      items: query.itemIds
        .map((id) => map.get(id))
        .filter((row) => row && row.confidence >= 0.3)
        .map((row) => ({
          itemId: String(row.catalogItemId),
          pricePerBasePaise: row.retailEstimatePaise,
          asOf: row.date,
          source: row.source,
          sampleSize: row.sampleSize,
          confidence: row.confidence,
          demo: row.source === 'simulated',
        })),
    });
  });
  router.get('/pricing/history/:itemId', async (req, res) => {
    const { params: path } = validateRequest(req, emptySchema, emptySchema, params);
    await pricing.resolvePrices(req.merchant._id, [path.itemId]);
    const [own, market] = await Promise.all([
      PriceHistory.find({ merchantId: req.merchant._id, itemId: path.itemId })
        .select('oldPaise newPaise at reason')
        .sort({ at: -1 })
        .limit(50)
        .lean(),
      config.MARKET_FEED === 'off'
        ? []
        : MarketPrice.find({
            regionId: req.merchant.location?.regionId,
            catalogItemId: path.itemId,
            date: { $gte: new Date(Date.now() - 30 * 86400000) },
            source:
              config.MARKET_FEED === 'simulated'
                ? 'simulated'
                : { $in: ['agmarknet', 'crowd', 'seed'] },
            confidence: { $gte: 0.3 },
            $or: [{ source: { $ne: 'crowd' } }, { sampleSize: { $gte: 5 } }],
          })
            .select('date retailEstimatePaise source confidence sampleSize -_id')
            .sort({ date: 1 })
            .limit(90)
            .lean(),
    ]);
    res.json({ own, market });
  });
  router.put('/merchant-items/:itemId/price', async (req, res) => {
    const { body, params: path } = validateRequest(req, priceBody, emptySchema, params);
    const result = await updateMerchantItem(
      req.merchant._id,
      path.itemId,
      Object.hasOwn(body, 'savedPricePaise') ? { savedPricePaise: body.savedPricePaise } : {},
      { undoOf: body.undoOf },
    );
    await auth.audit(req, body.undoOf ? 'price_undone' : 'price_changed', req.merchant._id);
    res.json({
      ...result,
      price: (await pricing.resolvePrices(req.merchant._id, [path.itemId]))[0],
    });
  });
  router.use('/pricing/admin', (req, _res, next) => {
    if (!(config.PRICING_ADMIN_MERCHANT_IDS || []).includes(String(req.merchant._id)))
      return next(problem(403, 'ADMIN_REQUIRED'));
    next();
  });
  router.post('/pricing/admin/ingest', async (req, res) => {
    validateRequest(req);
    jobs.run().catch(() => {});
    res.status(202).json({ status: 'scheduled' });
  });
  router.get('/pricing/admin/status', async (req, res) => {
    validateRequest(req);
    res.json({ job: await PricingJob.findById('daily').lean() });
  });
  router.get('/pricing/admin/commodities', async (req, res) => {
    validateRequest(req);
    res.json({
      commodities: await jobs.discover({
        state: req.merchant.location.state,
        district: req.merchant.location.district,
      }),
      attribution: 'Ministry of Agriculture & Farmers Welfare / data.gov.in (Agmarknet)',
    });
  });
  router.post('/pricing/admin/mappings', async (req, res) => {
    const { body } = validateRequest(
      req,
      z
        .object({
          commodity: z.string().min(1).max(160),
          catalogItemId: objectIdSchema,
          factorNumerator: z.number().int().min(1).max(10000),
          factorDenominator: z.number().int().min(1).max(10000),
        })
        .strict(),
    );
    const [commodities, item] = await Promise.all([
      jobs.discover({
        state: req.merchant.location.state,
        district: req.merchant.location.district,
      }),
      CatalogItem.findOne({ _id: body.catalogItemId, baseUnit: 'g', active: true }).lean(),
    ]);
    if (!item || !commodities.includes(body.commodity)) throw problem(400, 'VALIDATION_FAILED');
    const mapping = await CommodityMapping.findOneAndUpdate(
      { commodity: body.commodity, catalogItemId: body.catalogItemId },
      { $set: { ...body, approvedAt: null }, $unset: { approvedBy: '' } },
      { upsert: true, new: true },
    );
    res.status(201).json({ mapping });
  });
  router.put('/pricing/admin/mappings/:itemId/approve', async (req, res) => {
    const { params: path } = validateRequest(req, emptySchema, emptySchema, params);
    const mapping = await CommodityMapping.findByIdAndUpdate(
      path.itemId,
      { $set: { approvedAt: new Date(), approvedBy: req.merchant._id } },
      { new: true },
    );
    if (!mapping) throw problem(404, 'NOT_FOUND');
    await auth.audit(req, 'commodity_mapping_approved', req.merchant._id);
    res.json({ mapping });
  });
  return router;
}
