import mongoose from 'mongoose';
import { catalogLanguages, categories } from '@kirana/shared/catalog';
import { unitSize } from '@kirana/shared/units';

const { Schema } = mongoose;
const options = { timestamps: true, strict: 'throw' };
const catalog = new Schema(
  {
    slug: { type: String, required: true },
    names: new Schema(
      Object.fromEntries(catalogLanguages.map((code) => [code, { type: String, required: true }])),
      { _id: false },
    ),
    aliases: [new Schema({ lang: String, text: String }, { _id: false })],
    category: { type: String, enum: categories },
    subcategory: String,
    brand: String,
    kind: { type: String, enum: ['loose', 'packed'] },
    baseUnit: { type: String, enum: ['g', 'ml', 'pc'] },
    allowedUnits: [{ type: String, enum: Object.keys(unitSize) }],
    packSizes: [new Schema({ label: String, qtyBase: Number, mrpPaise: Number }, { _id: false })],
    defaultPricePaise: Number,
    priceClass: { type: String, enum: ['commodity', 'packaged'] },
    mrpPaise: Number,
    gstRate: Number,
    barcode: String,
    icon: String,
    tags: [String],
    active: { type: Boolean, default: true },
    nameReview: Schema.Types.Mixed,
    nameMethods: Schema.Types.Mixed,
    priceProvenance: { type: String, enum: ['synthetic', 'reviewed'] },
    maxQtyBase: Number,
  },
  options,
);
catalog.index({ slug: 1 }, { unique: true });
catalog.index({ category: 1, active: 1 });
catalog.index({ barcode: 1 }, { sparse: true, unique: true });
const merchantItem = new Schema(
  {
    merchantId: { type: Schema.Types.ObjectId, required: true },
    catalogItemId: { type: Schema.Types.ObjectId, default: null },
    name: String,
    unit: { type: String, enum: Object.keys(unitSize) },
    kind: { type: String, enum: ['loose', 'packed'] },
    savedPricePaise: Number,
    priceSetAt: Date,
    priceRevision: String,
    wholesaleAtSavePaise: Number,
    costPricePaise: Number,
    hidden: { type: Boolean, default: false },
    favourite: { type: Boolean, default: false },
    lastSoldAt: Date,
    deletedAt: { type: Date, default: null },
  },
  options,
);
merchantItem.index(
  { merchantId: 1, catalogItemId: 1 },
  { unique: true, partialFilterExpression: { catalogItemId: { $type: 'objectId' } } },
);
merchantItem.index({ merchantId: 1, deletedAt: 1 });
const nomination = new Schema(
  {
    merchantId: { type: Schema.Types.ObjectId, required: true },
    merchantItemId: { type: Schema.Types.ObjectId, required: true },
    name: String,
    unit: String,
    kind: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  },
  options,
);
nomination.index({ merchantId: 1, merchantItemId: 1 }, { unique: true });

export const CatalogItem = mongoose.model('CatalogItem', catalog, 'catalogItems');
export const MerchantItem = mongoose.model('MerchantItem', merchantItem, 'merchantItems');
export const CatalogNomination = mongoose.model(
  'CatalogNomination',
  nomination,
  'catalogNominations',
);
export async function ensureCatalogIndexes() {
  await Promise.all([CatalogItem, MerchantItem, CatalogNomination].map((model) => model.init()));
}
