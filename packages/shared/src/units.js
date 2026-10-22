import { mulDivRound } from './money.js';

export const baseUnits = Object.freeze(['g', 'ml', 'pc']);
export const unitSize = Object.freeze({
  g: 1,
  kg: 1000,
  ml: 1,
  L: 1000,
  pc: 1,
  dozen: 12,
  packet: 1,
});
export const unitBase = Object.freeze({
  g: 'g',
  kg: 'g',
  ml: 'ml',
  L: 'ml',
  pc: 'pc',
  dozen: 'pc',
  packet: 'pc',
});

export const priceUnit = Object.freeze({ g: 'kg', ml: 'L', pc: 'pc' });
const max = BigInt(Number.MAX_SAFE_INTEGER);
function safe(value) {
  if (value < 0n || value > max) throw new RangeError('Quantity exceeds the safe integer range');
  return Number(value);
}
function integer(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError('Expected non-negative integer base units');
  return BigInt(value);
}
function validUnit(unit) {
  if (!Object.hasOwn(unitSize, unit)) throw new RangeError('Unknown unit');
  return unit;
}
/** Parse a decimal display quantity into integer g, ml or pc; reject sub-base-unit fractions. */
export function parseQty(value, unit) {
  const text = String(value).trim();
  if (text.length > 80) throw new RangeError('Quantity is too long');
  const match = text.match(/^(\d+)(?:\.(\d{1,6}))?(?:\s*(kg|g|L|ml|pc|dozen|packet))?$/);
  if (!match || (!unit && !match[3]) || (unit && match[3] && unit !== match[3]))
    throw new RangeError('Invalid quantity');
  const selected = validUnit(unit || match[3]);
  const divisor = 10n ** BigInt((match[2] || '').length);
  const scaled = BigInt(match[1] + (match[2] || '')) * BigInt(unitSize[selected]);
  if (scaled % divisor) throw new RangeError('Fraction of a base unit is not allowed');
  return safe(scaled / divisor);
}
/** Exact decimal string. Non-terminating conversions (one piece to dozens) require the base unit. */
export function convertQty(value, fromUnit, toUnit) {
  validUnit(fromUnit);
  validUnit(toUnit);
  if (unitBase[fromUnit] !== unitBase[toUnit]) throw new RangeError('Incompatible units');
  const qty = BigInt(parseQty(value, fromUnit));
  const divisor = BigInt(unitSize[toUnit]);
  let remainder = qty % divisor;
  let fraction = '';
  while (remainder && fraction.length < 12) {
    remainder *= 10n;
    fraction += remainder / divisor;
    remainder %= divisor;
  }
  if (remainder) throw new RangeError('Use the base unit for an exact quantity');
  return `${qty / divisor}${fraction ? `.${fraction}` : ''}`;
}
export function formatQty(
  qtyBase,
  baseUnit,
  { locale = 'en-IN', unitLabel = (value) => value } = {},
) {
  integer(qtyBase);
  if (!baseUnits.includes(baseUnit)) throw new RangeError('Unknown base unit');
  const display = qtyBase >= 1000 && baseUnit !== 'pc' ? priceUnit[baseUnit] : baseUnit;
  const exact = convertQty(qtyBase, baseUnit, display);
  const [whole, fraction] = exact.split('.');
  let text = new Intl.NumberFormat(locale).format(BigInt(whole));
  if (fraction) {
    const decimal = new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === 'decimal').value;
    text +=
      decimal +
      new Intl.NumberFormat(locale, {
        minimumIntegerDigits: fraction.length,
        useGrouping: false,
      }).format(BigInt(fraction));
  }
  return `${text} ${unitLabel(display)}`;
}
export function lineAmount(qtyBase, pricePerUnitPaise, size) {
  return mulDivRound(qtyBase, pricePerUnitPaise, size);
}
/** Return the exact affordable grams and a separate conservative shop suggestion; never hide a difference. */
export function amountToQuantity(amountPaise, pricePerUnitPaise, size, displayStep = 10) {
  const amount = integer(amountPaise),
    price = integer(pricePerUnitPaise),
    divisor = integer(size),
    step = integer(displayStep);
  if (!price || !divisor || !step)
    throw new RangeError('Price, unit size and step must be positive');
  const raw = safe((amount * divisor) / price);
  const suggestedQtyBase = raw < displayStep ? raw : raw - (raw % displayStep);
  return {
    qtyBase: raw,
    suggestedQtyBase,
    suggestedAmountPaise: lineAmount(suggestedQtyBase, pricePerUnitPaise, size),
  };
}
export function quantityImplausible(qtyBase, item) {
  integer(qtyBase);
  return Number.isSafeInteger(item.maxQtyBase) && qtyBase > item.maxQtyBase;
}
