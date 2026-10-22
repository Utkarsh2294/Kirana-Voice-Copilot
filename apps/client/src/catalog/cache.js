import Dexie from 'dexie';

const db = new Dexie('kirana-catalog-cache-v1');
db.version(1).stores({ snapshots: 'merchantId' });
export async function readCatalogCache(merchantId) {
  const record = await db.snapshots.get(merchantId);
  if (
    !record ||
    !Array.isArray(record.items) ||
    !record.items.every(
      (item) =>
        typeof item.id === 'string' &&
        item.names &&
        typeof item.names.en === 'string' &&
        ['g', 'ml', 'pc'].includes(item.baseUnit) &&
        ['kg', 'L', 'pc'].includes(item.priceUnit) &&
        Array.isArray(item.allowedUnits) &&
        Object.values(item.names).every((value) => typeof value === 'string') &&
        Number.isSafeInteger(item.pricePaise) &&
        item.pricePaise >= 0 &&
        Number.isSafeInteger(item.unitSize) &&
        item.unitSize > 0,
    )
  )
    return null;
  return record;
}
export async function writeCatalogCache(merchantId, items) {
  await db.snapshots.put({ merchantId, items, at: new Date().toISOString() });
}
export async function clearCatalogCache(merchantId) {
  await db.snapshots.delete(merchantId);
}
