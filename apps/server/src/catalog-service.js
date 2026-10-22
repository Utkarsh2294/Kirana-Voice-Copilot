import mongoose from 'mongoose';
import { createCatalogSearch } from '@kirana/shared/catalog-search';
import { priceUnit, unitBase, unitSize } from '@kirana/shared/units';
import { CatalogItem, MerchantItem } from './catalog-models.js';

export function createCatalogService() {
  let current = null,
    loading = null;
  async function reload() {
    const items = await CatalogItem.find({ active: true }).lean();
    current = createCatalogSearch(items);
    return current;
  }
  async function get() {
    if (current?.byId.size) return current;
    if (!loading)
      loading = reload().finally(() => {
        loading = null;
      });
    return loading;
  }
  return { get, reload };
}
export const catalogService = createCatalogService();

export async function salesFrequency(merchantId) {
  // Read the Phase 8 bill contract; no bills are created by the catalog phase.
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await mongoose.connection.db
    .collection('bills')
    .aggregate(
      [
        {
          $match: {
            merchantId: new mongoose.Types.ObjectId(merchantId),
            createdAt: { $gte: since },
            'payment.status': 'paid',
          },
        },
        { $unwind: '$lines' },
        {
          $group: {
            _id: {
              item: { $ifNull: ['$lines.catalogItemId', '$lines.merchantItemId'] },
              bill: '$_id',
            },
            lastSoldAt: { $max: '$createdAt' },
          },
        },
        {
          $group: { _id: '$_id.item', frequency: { $sum: 1 }, lastSoldAt: { $max: '$lastSoldAt' } },
        },
      ],
      { maxTimeMS: 2000 },
    )
    .toArray();
  return new Map(
    rows
      .filter((row) => row._id)
      .map((row) => [String(row._id), { frequency: row.frequency, lastSoldAt: row.lastSoldAt }]),
  );
}
export async function mergedItems(merchantId, service = catalogService) {
  const index = await service.get();
  const overrides = await MerchantItem.find({ merchantId, deletedAt: null }).lean();
  const byCatalog = new Map(
    overrides
      .filter((item) => item.catalogItemId)
      .map((item) => [String(item.catalogItemId), item]),
  );
  const global = [...index.byId].map(([id, item]) => view(item, byCatalog.get(id), id));
  const custom = overrides
    .filter((item) => !item.catalogItemId)
    .map((item) => view(null, item, String(item._id)));
  return [...global, ...custom];
}
function view(catalog, merchant, id) {
  const baseUnit = catalog?.baseUnit || unitBase[merchant.unit];
  const ownPrice = merchant?.savedPricePaise;
  const hasOwn = Number.isSafeInteger(ownPrice);
  return {
    id,
    catalogItemId: catalog ? String(catalog._id) : null,
    merchantItemId: merchant ? String(merchant._id) : null,
    slug: catalog?.slug || id,
    names: catalog?.names || { en: merchant.name },
    aliases: catalog?.aliases || [],
    category: catalog?.category || 'custom',
    subcategory: catalog?.subcategory || 'custom',
    brand: catalog?.brand || '',
    kind: catalog?.kind || merchant.kind,
    baseUnit,
    unit: merchant?.unit || priceUnit[baseUnit],
    priceUnit: priceUnit[baseUnit],
    unitSize: unitSize[priceUnit[baseUnit]],
    allowedUnits:
      catalog?.allowedUnits ||
      (baseUnit === 'g'
        ? ['kg', 'g']
        : baseUnit === 'ml'
          ? ['L', 'ml']
          : ['pc', 'dozen', 'packet']),
    pricePaise: hasOwn ? ownPrice : catalog.defaultPricePaise,
    savedPricePaise: hasOwn ? ownPrice : null,
    costPricePaise: merchant?.costPricePaise ?? null,
    priceSource: hasOwn ? 'merchant' : catalog.priceProvenance === 'synthetic' ? 'demo' : 'mrp',
    packSizes: catalog?.packSizes || [],
    nameReview: catalog?.nameReview || {},
    nameMethods: catalog?.nameMethods || {},
    maxQtyBase: catalog?.maxQtyBase || (baseUnit === 'pc' ? 100 : 25000),
    hidden: merchant?.hidden || false,
    favourite: merchant?.favourite || false,
    lastSoldAt: merchant?.lastSoldAt || null,
  };
}
