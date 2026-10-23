import { createHash } from 'node:crypto';
import { z } from 'zod';
import { toPaise, mulDivRound } from '@kirana/shared/money';
import { guardMarketPrice, median, trimmedMedian, retailEstimate } from '@kirana/shared/pricing';
import { CatalogItem, MerchantItem } from './catalog-models.js';
import { Merchant } from './models.js';
import { MarketPrice, CommodityMapping, PricingJob } from './pricing-models.js';
import { problem } from './http.js';

export const dayIST = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
const dayDate = (date) => new Date(`${dayIST(date)}T00:00:00+05:30`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function simulatedPrice(region, item, date, previous) {
  const random = createHash('sha256')
    .update(`${region}:${item._id}:${dayIST(date)}`)
    .digest()
    .readUInt32BE(0);
  return mulDivRound(previous ?? item.defaultPricePaise, 9200 + (random % 1601), 10000);
}
export async function fetchAgmarknet(config, { fetcher = fetch, wait = sleep, filters = {} } = {}) {
  if (!config.DATA_GOV_IN_API_KEY) throw problem(503, 'FEED_NOT_CONFIGURED');
  const records = [];
  for (let page = 0; page < 100; page++) {
    const url = new URL(`https://api.data.gov.in/resource/${config.DATA_GOV_IN_RESOURCE_ID}`);
    url.search = new URLSearchParams({
      'api-key': config.DATA_GOV_IN_API_KEY,
      format: 'json',
      limit: '100',
      offset: String(page * 100),
      ...Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [`filters[${key}]`, value]),
      ),
    });
    let data;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) {
          if (response.status !== 429 && response.status < 500) throw problem(502, 'FEED_REJECTED');
          throw problem(503, 'FEED_UNAVAILABLE');
        }
        data = z
          .object({
            records: z.array(
              z
                .object({
                  state: z.string(),
                  district: z.string(),
                  commodity: z.string(),
                  arrival_date: z.string(),
                  min_price: z.union([z.string(), z.number()]),
                  max_price: z.union([z.string(), z.number()]),
                  modal_price: z.union([z.string(), z.number()]),
                })
                .passthrough(),
            ),
            total: z.coerce.number().optional(),
          })
          .parse(await response.json());
        break;
      } catch (error) {
        if (error.code === 'FEED_REJECTED' || attempt === 2) throw problem(503, 'FEED_UNAVAILABLE');
        await wait(250 * 2 ** attempt);
      }
    }
    records.push(...data.records);
    if (data.records.length < 100 || records.length >= data.total) return records;
  }
  throw problem(503, 'FEED_TOO_LARGE');
}
export function wholesaleFromRecord(record, mapping) {
  // Published values are rupees/quintal. Conversion to paise/kg precedes the human-approved crop factor.
  const [day, month, year] = record.arrival_date.split('/');
  const date = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
  if (!Number.isFinite(+date)) throw problem(502, 'FEED_REJECTED');
  const min = toPaise(record.min_price),
    max = toPaise(record.max_price),
    modal = toPaise(record.modal_price);
  if (min > modal || modal > max || modal === 0) throw problem(502, 'FEED_REJECTED');
  return {
    date,
    paise: mulDivRound(modal, mapping.factorNumerator, 100 * mapping.factorDenominator),
  };
}
function markupFor(item) {
  return item.category === 'vegetables'
    ? 2500
    : item.subcategory === 'pulses' || /dal|pulse|lentil|gram/.test(item.slug)
      ? 1200
      : 1000;
}
export function createMarketJobs({ config, pricing, logger, fetcher, clock = () => new Date() }) {
  async function run() {
    if (config.MARKET_FEED === 'off') return { mode: 'off', updated: 0 };
    const now = clock(),
      until = new Date(+now + 20 * 60000);
    // One durable lease across API replicas; every write is also idempotent by source/day/item/region.
    try {
      await PricingJob.updateOne(
        { _id: 'daily', $or: [{ leaseUntil: { $lt: now } }, { leaseUntil: null }] },
        { $set: { leaseUntil: until } },
        { upsert: true },
      );
    } catch (error) {
      if (error.code === 11000) return { busy: true };
      throw error;
    }
    let updated = 0;
    try {
      const [merchants, catalog] = await Promise.all([
        Merchant.find({ status: 'active', onboardingStep: 4 }).select('location').lean(),
        CatalogItem.find({ active: true }).lean(),
      ]);
      const regions = new Map(
        merchants
          .filter((row) => row.location?.regionId)
          .map((row) => [row.location.regionId, row.location]),
      );
      const own = await MerchantItem.find({
        savedPricePaise: { $gt: 0 },
        deletedAt: null,
        hidden: false,
        catalogItemId: { $ne: null },
        $or: [
          { priceSetAt: { $gte: new Date(+now - 14 * 86400000) } },
          { priceSetAt: null, updatedAt: { $gte: new Date(+now - 14 * 86400000) } },
        ],
      }).lean();
      const ownerRegion = new Map(
        merchants.map((row) => [String(row._id), row.location?.regionId]),
      );
      const groups = new Map();
      for (const row of own) {
        const region = ownerRegion.get(String(row.merchantId));
        if (!region) continue;
        const key = `${region}:${row.catalogItemId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row.savedPricePaise);
      }
      for (const [regionId, location] of regions) {
        if (config.MARKET_FEED === 'simulated') {
          const writes = [];
          const existing = await MarketPrice.find({
            regionId,
            source: 'simulated',
            date: { $gte: dayDate(new Date(+now - 30 * 86400000)) },
          }).lean();
          const previous = new Map(
            existing.map((row) => [
              `${row.catalogItemId}:${dayIST(row.date)}`,
              row.retailEstimatePaise,
            ]),
          );
          for (const item of catalog) {
            let value =
              previous.get(`${item._id}:${dayIST(new Date(+now - 30 * 86400000))}`) ??
              item.defaultPricePaise;
            for (let age = 29; age >= 0; age--) {
              const date = dayDate(new Date(+now - age * 86400000));
              value =
                previous.get(`${item._id}:${dayIST(date)}`) ??
                guardMarketPrice(simulatedPrice(regionId, item, date, value), value);
              writes.push({
                updateOne: {
                  filter: { regionId, catalogItemId: item._id, date, source: 'simulated' },
                  update: {
                    $setOnInsert: { retailEstimatePaise: value, sampleSize: 0, confidence: 0.6 },
                  },
                  upsert: true,
                },
              });
            }
          }
          for (let offset = 0; offset < writes.length; offset += 1000) {
            const result = await MarketPrice.bulkWrite(writes.slice(offset, offset + 1000), {
              ordered: false,
            });
            updated += result.upsertedCount;
          }
          continue;
        }
        let raw = [];
        if (config.MARKET_FEED === 'agmarknet') {
          try {
            raw = await fetchAgmarknet(config, {
              fetcher,
              filters: { state: location.state, district: location.district },
            });
          } catch {
            logger.warn(
              { code: 'FEED_UNAVAILABLE' },
              'Agmarknet unavailable; using crowd and last good values',
            );
          }
        }
        const mappings = await CommodityMapping.find({ approvedAt: { $ne: null } }).lean();
        for (const item of catalog) {
          const samples = groups.get(`${regionId}:${item._id}`) || [];
          const crowd = trimmedMedian(samples);
          const mapped = mappings.filter((row) => String(row.catalogItemId) === String(item._id));
          const wholesaleRows = raw
            .flatMap((record) => {
              const mapping = mapped.find((row) => row.commodity === record.commodity);
              if (!mapping) return [];
              try {
                return [wholesaleFromRecord(record, mapping)];
              } catch {
                return [];
              }
            })
            .filter((row) => +row.date <= +now);
          const newest = wholesaleRows.length && Math.max(...wholesaleRows.map((row) => +row.date));
          const wholesale = newest
            ? median(wholesaleRows.filter((row) => +row.date === newest).map((row) => row.paise))
            : null;
          const observations = wholesale
            ? samples
                .filter((value) => value >= wholesale)
                .map((value) =>
                  Math.min(
                    100000,
                    Number((BigInt(value - wholesale) * 10000n) / BigInt(wholesale)),
                  ),
                )
            : [];
          const retail = wholesale
            ? retailEstimate(wholesale, markupFor(item), observations)
            : null;
          const corroborated =
            crowd != null && retail != null && Math.abs(crowd - retail) * 100 <= retail * 3;
          for (const candidate of [
            crowd == null
              ? null
              : {
                  source: 'crowd',
                  date: dayDate(now),
                  price: crowd,
                  confidence: 0.7,
                  sampleSize: samples.length,
                },
            retail == null
              ? null
              : {
                  source: 'agmarknet',
                  date: new Date(newest),
                  price: retail,
                  confidence: 0.55,
                  sampleSize: wholesaleRows.length,
                  wholesaleModalPaise: wholesale,
                },
          ].filter(Boolean)) {
            const last = await MarketPrice.findOne({
              regionId,
              catalogItemId: item._id,
              source: candidate.source,
              date: { $lt: candidate.date },
            })
              .sort({ date: -1 })
              .lean();
            const result = await MarketPrice.updateOne(
              { regionId, catalogItemId: item._id, date: candidate.date, source: candidate.source },
              {
                $set: {
                  retailEstimatePaise: guardMarketPrice(
                    candidate.price,
                    last?.retailEstimatePaise,
                    corroborated,
                  ),
                  sampleSize: candidate.sampleSize,
                  confidence: candidate.confidence,
                  ...(candidate.wholesaleModalPaise
                    ? { wholesaleModalPaise: candidate.wholesaleModalPaise }
                    : {}),
                },
              },
              { upsert: true },
            );
            updated += result.upsertedCount + result.modifiedCount;
          }
        }
      }
      pricing.invalidate();
      await PricingJob.updateOne(
        { _id: 'daily' },
        { $set: { lastRunAt: now, result: { updated, mode: config.MARKET_FEED } } },
      );
      return { updated, mode: config.MARKET_FEED };
    } catch (error) {
      logger.warn(
        { code: error.code || 'FEED_UNAVAILABLE' },
        'Market job retained last good values',
      );
      throw error;
    } finally {
      await PricingJob.updateOne({ _id: 'daily' }, { $set: { leaseUntil: new Date(0) } });
    }
  }
  return {
    run,
    discover: async (filters = {}) =>
      [
        ...new Set(
          (await fetchAgmarknet(config, { fetcher, filters })).map((row) => row.commodity),
        ),
      ].sort(),
  };
}
