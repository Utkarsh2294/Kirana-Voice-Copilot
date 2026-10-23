import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { isStale, priceNudges } from '@kirana/shared/pricing';
import { unitBase, priceUnit, unitSize } from '@kirana/shared/units';
import { CatalogItem, MerchantItem } from './catalog-models.js';
import { Merchant } from './models.js';
import { MarketPrice, PriceHistory } from './pricing-models.js';
import { problem } from './http.js';

export function createPricingService({ config, clock = () => new Date() }) {
  const cache = new Map();
  function invalidate() {
    cache.clear();
  }
  async function marketFor(regionId) {
    if (config.MARKET_FEED === 'off' || !regionId) return new Map();
    const entry = cache.get(regionId);
    if (entry && entry.until > +clock()) return entry.value;
    const rows = await MarketPrice.find({
      regionId,
      source:
        config.MARKET_FEED === 'simulated' ? 'simulated' : { $in: ['crowd', 'agmarknet', 'seed'] },
    })
      .sort({ date: -1, confidence: -1 })
      .lean();
    const value = new Map();
    for (const row of rows) {
      if (row.source === 'crowd' && row.sampleSize < 5) continue;
      const id = String(row.catalogItemId);
      if (!value.has(id)) value.set(id, row);
    }
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(regionId, { until: +clock() + 300000, value });
    return value;
  }
  async function resolvePrices(merchantId, itemIds) {
    const merchant = await Merchant.findById(merchantId).lean();
    if (!merchant) throw problem(404, 'NOT_FOUND');
    const [catalog, own, market] = await Promise.all([
      CatalogItem.find({ _id: { $in: itemIds }, active: true }).lean(),
      MerchantItem.find({
        merchantId,
        deletedAt: null,
        $or: [{ catalogItemId: { $in: itemIds } }, { _id: { $in: itemIds }, catalogItemId: null }],
      }).lean(),
      marketFor(merchant.location?.regionId),
    ]);
    const globals = new Map(catalog.map((row) => [String(row._id), row]));
    const overrides = new Map(own.map((row) => [String(row.catalogItemId || row._id), row]));
    return itemIds.map((id) => {
      const item = globals.get(id),
        override = overrides.get(id),
        estimate = market.get(id);
      if (!item && !override) throw problem(404, 'NOT_FOUND');
      const canonical = priceUnit[item?.baseUnit || unitBase[override.unit]];
      const saved = Number.isSafeInteger(override?.savedPricePaise);
      const usable = estimate && estimate.confidence >= 0.3;
      const price = saved
        ? override.savedPricePaise
        : usable
          ? estimate.retailEstimatePaise
          : (item.mrpPaise ?? item.defaultPricePaise);
      const source = saved ? 'merchant' : usable ? 'market' : 'mrp';
      return {
        itemId: id,
        pricePerBasePaise: price,
        source,
        unit: canonical,
        unitSize: unitSize[canonical],
        asOf: saved
          ? override.priceSetAt || override.updatedAt
          : usable
            ? estimate.date
            : item.updatedAt,
        confidence: saved
          ? 1
          : usable
            ? estimate.confidence
            : item.priceProvenance === 'synthetic'
              ? 0.3
              : 0.8,
        demo:
          !saved &&
          (usable ? estimate.source === 'simulated' : item.priceProvenance === 'synthetic'),
        stale: Boolean(estimate && isStale(estimate.date, clock())),
        fallbackReason:
          !saved && !usable
            ? config.MARKET_FEED === 'off'
              ? 'feed-off'
              : estimate
                ? 'low-confidence'
                : 'no-market'
            : null,
        marketSource: usable ? estimate.source : null,
        nudges: priceNudges({
          saved: saved ? price : null,
          savedAt: override?.priceSetAt || override?.updatedAt,
          market: usable ? estimate : null,
          cost: override?.costPricePaise,
          targetMarginBps: merchant.settings?.targetMarginBps ?? 800,
          now: clock(),
          wholesaleThen: override?.wholesaleAtSavePaise,
        }),
      };
    });
  }
  return { resolvePrices, marketFor, invalidate };
}

export async function updateMerchantItem(merchantId, itemId, body, { undoOf, reason } = {}) {
  let result;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await mongoose.connection.transaction(async (session) => {
        const catalog = await CatalogItem.findOne({ _id: itemId, active: true })
          .session(session)
          .lean();
        let row = await MerchantItem.findOne(
          catalog
            ? { merchantId, catalogItemId: itemId }
            : { _id: itemId, merchantId, catalogItemId: null, deletedAt: null },
        ).session(session);
        if (!catalog && !row) throw problem(404, 'NOT_FOUND');
        if (!row) row = new MerchantItem({ merchantId, catalogItemId: itemId });
        const base = catalog?.baseUnit || unitBase[row.unit];
        if (
          body.unit &&
          (unitBase[body.unit] !== base || (catalog && !catalog.allowedUnits.includes(body.unit)))
        )
          throw problem(400, 'VALIDATION_FAILED');
        let patch = { ...body };
        if (undoOf) {
          const change = await PriceHistory.findOne({ _id: undoOf, merchantId, itemId })
            .session(session)
            .lean();
          if (!change || row.priceRevision !== change.revision) throw problem(409, 'PRICE_CHANGED');
          patch = { savedPricePaise: change.oldPaise };
        }
        if (!catalog && patch.savedPricePaise === null) throw problem(400, 'VALIDATION_FAILED');
        let change = null;
        if (
          Object.hasOwn(patch, 'savedPricePaise') &&
          (row.savedPricePaise ?? null) !== patch.savedPricePaise
        ) {
          row.priceRevision = randomUUID();
          row.priceSetAt = new Date();
          const wholesale =
            catalog &&
            (await MarketPrice.findOne({
              regionId: (await Merchant.findById(merchantId).session(session).lean()).location
                ?.regionId,
              catalogItemId: itemId,
              source: 'agmarknet',
              confidence: { $gte: 0.3 },
            })
              .sort({ date: -1 })
              .session(session)
              .lean());
          row.wholesaleAtSavePaise = wholesale?.wholesaleModalPaise;
          [change] = await PriceHistory.create(
            [
              {
                merchantId,
                itemId,
                oldPaise: row.savedPricePaise ?? null,
                newPaise: patch.savedPricePaise,
                revision: row.priceRevision,
                reason: undoOf
                  ? 'undo'
                  : reason || (patch.savedPricePaise === null ? 'reset' : 'saved'),
              },
            ],
            { session },
          );
        }
        for (const [key, value] of Object.entries(patch))
          row[key] = value === null ? undefined : value;
        await row.save({ session });
        result = { undoId: change ? String(change._id) : null };
      });
      return result;
    } catch (error) {
      if (error.code !== 11000 || attempt) throw error;
    }
  }
}

export async function createCustomItem(merchantId, body) {
  let row;
  await mongoose.connection.transaction(async (session) => {
    const revision = randomUUID();
    [row] = await MerchantItem.create(
      [
        {
          ...body,
          merchantId,
          catalogItemId: null,
          priceSetAt: new Date(),
          priceRevision: revision,
        },
      ],
      { session },
    );
    await PriceHistory.create(
      [
        {
          merchantId,
          itemId: row._id,
          oldPaise: null,
          newPaise: body.savedPricePaise,
          reason: 'custom',
          revision,
        },
      ],
      { session },
    );
  });
  return row;
}
