import mongoose from 'mongoose';
const { Schema } = mongoose;
const money = {
  type: Number,
  min: 0,
  validate: (value) => value == null || Number.isSafeInteger(value),
};
const market = new Schema(
  {
    regionId: { type: String, required: true },
    catalogItemId: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, required: true },
    source: { type: String, enum: ['agmarknet', 'crowd', 'seed', 'simulated'] },
    wholesaleModalPaise: money,
    retailEstimatePaise: { ...money, required: true },
    sampleSize: { type: Number, min: 0 },
    confidence: { type: Number, min: 0, max: 1 },
  },
  { timestamps: true, strict: 'throw' },
);
market.index({ regionId: 1, catalogItemId: 1, date: -1, source: 1 }, { unique: true });
const history = new Schema(
  {
    merchantId: { type: Schema.Types.ObjectId, required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    oldPaise: { ...money, default: null },
    newPaise: { ...money, default: null },
    at: { type: Date, default: Date.now },
    reason: { type: String, enum: ['saved', 'reset', 'undo', 'custom'] },
    revision: String,
  },
  { strict: 'throw' },
);
history.index({ merchantId: 1, itemId: 1, at: -1 });
const mapping = new Schema(
  {
    commodity: { type: String, required: true },
    catalogItemId: { type: Schema.Types.ObjectId, required: true },
    factorNumerator: { type: Number, min: 1, default: 1 },
    factorDenominator: { type: Number, min: 1, default: 1 },
    approvedAt: { type: Date, default: null },
    approvedBy: Schema.Types.ObjectId,
  },
  { timestamps: true, strict: 'throw' },
);
mapping.index({ commodity: 1, catalogItemId: 1 }, { unique: true });
const job = new Schema({
  _id: String,
  leaseUntil: Date,
  lastRunAt: Date,
  result: Schema.Types.Mixed,
});
export const MarketPrice = mongoose.model('MarketPrice', market, 'marketPrices');
export const PriceHistory = mongoose.model('PriceHistory', history, 'priceHistory');
export const CommodityMapping = mongoose.model('CommodityMapping', mapping, 'commodityMappings');
export const PricingJob = mongoose.model('PricingJob', job, 'pricingJobs');
export async function ensurePricingIndexes() {
  await Promise.all(
    [MarketPrice, PriceHistory, CommodityMapping, PricingJob].map((model) => model.init()),
  );
}
