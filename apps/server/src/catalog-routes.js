import { Router } from 'express';
import { z } from 'zod';
import { uiLanguageCodes } from '@kirana/shared/languages';
import {
  categories,
  customItemSchema,
  merchantItemPatchSchema,
  objectIdSchema,
} from '@kirana/shared/catalog';
import { emptySchema, problem, validateRequest } from './http.js';
import { MerchantItem, CatalogNomination } from './catalog-models.js';
import { catalogService, mergedItems, salesFrequency } from './catalog-service.js';
import { updateMerchantItem, createCustomItem } from './pricing-service.js';
import { createCatalogSearch, compareCatalogHits } from '@kirana/shared/catalog-search';

const idParams = z.object({ id: objectIdSchema }).strict();
const searchQuery = z
  .object({
    q: z.string().trim().min(1).max(120),
    lang: z.enum(uiLanguageCodes).default('en-IN'),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();
const viewQuery = z.object({ includeHidden: z.enum(['true', 'false']).default('false') }).strict();
function orderByHistory(a, b, stats) {
  return (
    (stats.get(b.id)?.frequency || 0) - (stats.get(a.id)?.frequency || 0) ||
    Number(b.favourite) - Number(a.favourite) ||
    new Date(stats.get(b.id)?.lastSoldAt || b.lastSoldAt || 0) -
      new Date(stats.get(a.id)?.lastSoldAt || a.lastSoldAt || 0) ||
    a.names.en.localeCompare(b.names.en)
  );
}

export function catalogRouter(auth, service = catalogService, pricing) {
  const router = Router();
  async function getItems(merchantId) {
    const items = await mergedItems(merchantId, service);
    if (!pricing || !items.length) return items;
    const quotes = new Map(
      (
        await pricing.resolvePrices(
          merchantId,
          items.map((item) => item.id),
        )
      ).map((quote) => [quote.itemId, quote]),
    );
    return items.map((item) => {
      const quote = quotes.get(item.id);
      return {
        ...item,
        pricePaise: quote.pricePerBasePaise,
        priceSource: quote.source === 'mrp' && quote.demo ? 'demo' : quote.source,
        pricing: quote,
      };
    });
  }
  router.use(auth.authenticate, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.merchant.onboardingStep < 4) return next(problem(403, 'ONBOARDING_REQUIRED'));
    next();
  });
  router.get('/catalog/search', async (req, res) => {
    const { query } = validateRequest(req, emptySchema, searchQuery);
    const items = await getItems(req.merchant._id);
    const stats = await salesFrequency(req.merchant._id);
    const visible = new Map(items.filter((item) => !item.hidden).map((item) => [item.id, item]));
    const index = await service.get();
    const global = index
      .scored(query.q, { limit: index.byId.size, stats })
      .map((hit) => ({ score: hit.score, item: visible.get(String(hit.item._id)) }))
      .filter((hit) => hit.item);
    const custom = items.filter((item) => !item.catalogItemId && !item.hidden);
    const extra = custom.length
      ? createCatalogSearch(custom).scored(query.q, { limit: query.limit, stats })
      : [];
    const ranked = [...global, ...extra]
      .sort(compareCatalogHits(stats))
      .slice(0, query.limit)
      .map((hit) => hit.item);
    res.json({
      items: ranked.map((item) => ({
        ...item,
        name: item.names[query.lang.split('-')[0]] || item.names.en,
      })),
      review: 'draft',
    });
  });
  router.get('/catalog/items/:id', async (req, res) => {
    const { params } = validateRequest(req, emptySchema, emptySchema, idParams);
    const item = (await getItems(req.merchant._id)).find(
      (item) => item.id === params.id && item.catalogItemId,
    );
    if (!item) throw problem(404, 'NOT_FOUND');
    res.json({ item });
  });
  router.get('/catalog/categories', async (req, res) => {
    validateRequest(req);
    const index = await service.get();
    res.json({
      categories: categories.map((id) => ({
        id,
        count: [...index.byId.values()].filter((item) => item.category === id).length,
      })),
    });
  });
  router.get('/catalog/frequent', async (req, res) => {
    validateRequest(req);
    const stats = await salesFrequency(req.merchant._id);
    const items = (await getItems(req.merchant._id)).filter((item) => !item.hidden);
    const sold = items.filter((item) => stats.has(item.id));
    const favourites = items.filter((item) => item.favourite);
    const basis = sold.length ? 'sales' : favourites.length ? 'favourites' : 'catalog';
    const source = sold.length ? sold : favourites.length ? favourites : items;
    res.json({ basis, items: source.sort((a, b) => orderByHistory(a, b, stats)).slice(0, 12) });
  });
  router.get('/merchant-items', async (req, res) => {
    const { query } = validateRequest(req, emptySchema, viewQuery);
    const [merged, stats] = await Promise.all([
      getItems(req.merchant._id),
      salesFrequency(req.merchant._id),
    ]);
    const items = merged.map((item) => ({
      ...item,
      salesFrequency30d: stats.get(item.id)?.frequency || 0,
      lastSoldAt: stats.get(item.id)?.lastSoldAt || item.lastSoldAt,
    }));
    res.json({
      items: query.includeHidden === 'true' ? items : items.filter((item) => !item.hidden),
      catalogVersion: 'draft-v1',
      review: 'draft',
    });
  });
  router.post('/merchant-items/custom', async (req, res) => {
    const { body } = validateRequest(req, customItemSchema);
    const item = await createCustomItem(req.merchant._id, body);
    await auth.audit(req, 'custom_item_created', req.merchant._id);
    const merged = (await getItems(req.merchant._id)).find((row) => row.id === String(item._id));
    res.status(201).json({ item: merged });
  });
  router.put('/merchant-items/:id', async (req, res) => {
    const { body, params } = validateRequest(req, merchantItemPatchSchema, emptySchema, idParams);
    const result = await updateMerchantItem(req.merchant._id, params.id, body);
    await auth.audit(req, 'merchant_item_changed', req.merchant._id);
    res.json({
      ...result,
      item: (await getItems(req.merchant._id)).find((row) => row.id === params.id),
    });
  });
  router.delete('/merchant-items/:id', async (req, res) => {
    const { params } = validateRequest(req, emptySchema, emptySchema, idParams);
    const item = await MerchantItem.findOneAndUpdate(
      { _id: params.id, merchantId: req.merchant._id, catalogItemId: null, deletedAt: null },
      { $set: { deletedAt: new Date(), hidden: true } },
    );
    if (!item) throw problem(404, 'NOT_FOUND');
    await auth.audit(req, 'custom_item_deleted', req.merchant._id);
    res.status(204).end();
  });
  router.post('/merchant-items/:id/nominate', async (req, res) => {
    const { params } = validateRequest(req, emptySchema, emptySchema, idParams);
    const item = await MerchantItem.findOne({
      _id: params.id,
      merchantId: req.merchant._id,
      catalogItemId: null,
      deletedAt: null,
    }).lean();
    if (!item) throw problem(404, 'NOT_FOUND');
    await CatalogNomination.findOneAndUpdate(
      { merchantId: req.merchant._id, merchantItemId: item._id },
      {
        $setOnInsert: {
          merchantId: req.merchant._id,
          merchantItemId: item._id,
          name: item.name,
          unit: item.unit,
          kind: item.kind,
          status: 'pending',
        },
      },
      { upsert: true },
    );
    res.status(202).json({ status: 'pending' });
  });
  return router;
}
