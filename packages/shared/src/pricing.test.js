import { expect, it } from 'vitest';
import {
  trimmedMedian,
  guardMarketPrice,
  retailEstimate,
  isStale,
  priceNudges,
} from './pricing.js';
it('requires five samples and trims ten percent before taking an exact median', () => {
  expect(trimmedMedian([1, 2, 3, 4])).toBeNull();
  expect(trimmedMedian([1, 2, 3, 4, 5])).toBe(3);
  expect(trimmedMedian(Array(6).fill(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  expect(trimmedMedian([1, 100, 101, 102, 103, 104, 105, 106, 107, 9999])).toBe(104);
});
it('caps unsupported daily moves, smooths half up, and permits corroborated moves', () => {
  expect(guardMarketPrice(20000, 10000)).toBe(10400);
  expect(guardMarketPrice(100, 10000)).toBe(9600);
  expect(guardMarketPrice(20000, 10000, true)).toBe(15000);
  expect(guardMarketPrice(101, 100, true)).toBe(101);
  expect(retailEstimate(10000, 1000)).toBe(11000);
  expect(retailEstimate(10000, 1000, Array(10).fill(2000))).toBe(11500);
});
it('flags stale values and separately identifies price drift, wholesale rises and low margins', () => {
  const now = new Date('2026-10-23T12:00:00Z');
  expect(isStale('2026-10-20T12:00:00Z', now)).toBe(false);
  expect(isStale('2026-10-20T11:59:59Z', now)).toBe(true);
  expect(
    priceNudges({
      saved: 10000,
      savedAt: '2026-10-01',
      market: { retailEstimatePaise: 12000, wholesaleModalPaise: 9000 },
      wholesaleThen: 8000,
      cost: 9500,
      now,
    }),
  ).toEqual(['drift', 'wholesale', 'margin']);
});
