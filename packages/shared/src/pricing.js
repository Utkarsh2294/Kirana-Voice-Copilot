import { addPaise, mulDivRound } from './money.js';

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : sorted[middle - 1] + mulDivRound(sorted[middle] - sorted[middle - 1], 1, 2);
}
export function trimmedMedian(values) {
  if (values.length < 5) return null;
  const sorted = [...values].sort((a, b) => a - b),
    trim = Math.floor(sorted.length / 10);
  return median(sorted.slice(trim, sorted.length - trim));
}
export function guardMarketPrice(candidate, previous, corroborated = false) {
  if (!previous) return candidate;
  const bounded = corroborated
    ? candidate
    : Math.max(
        mulDivRound(previous, 92, 100),
        Math.min(mulDivRound(previous, 108, 100), candidate),
      );
  return median([previous, bounded]);
}
export function retailEstimate(wholesale, defaultMarkupBps, observations = []) {
  const count = observations.length;
  const observed = count ? median(observations) : defaultMarkupBps;
  const markupBps = mulDivRound(addPaise(observed * count, defaultMarkupBps * 10), 1, count + 10);
  return mulDivRound(wholesale, 10000 + markupBps, 10000);
}
export const isStale = (date, now = new Date()) => now - new Date(date) > 3 * 86400000;
export function priceNudges({
  saved,
  savedAt,
  market,
  cost,
  targetMarginBps = 800,
  now = new Date(),
  wholesaleThen,
}) {
  const nudges = [];
  if (saved == null) return nudges;
  if (
    market &&
    savedAt &&
    now - new Date(savedAt) > 14 * 86400000 &&
    BigInt(Math.abs(saved - market.retailEstimatePaise)) * 100n >
      BigInt(market.retailEstimatePaise) * 7n
  )
    nudges.push('drift');
  if (
    market?.wholesaleModalPaise &&
    wholesaleThen &&
    market.wholesaleModalPaise > wholesaleThen &&
    saved < market.retailEstimatePaise
  )
    nudges.push('wholesale');
  if (
    cost != null &&
    (saved === 0 ||
      (BigInt(saved) - BigInt(cost)) * 10000n < BigInt(saved) * BigInt(targetMarginBps))
  )
    nudges.push('margin');
  return nudges;
}
