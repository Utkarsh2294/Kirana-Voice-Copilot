import { expect, it } from 'vitest';
import {
  parseQty,
  convertQty,
  formatQty,
  lineAmount,
  amountToQuantity,
  quantityImplausible,
} from './units.js';

it('keeps weights, volume, counts and packs exact', () => {
  expect(parseQty('1.5 kg')).toBe(1500);
  expect(convertQty('1500', 'g', 'kg')).toBe('1.5');
  expect(parseQty('0.5', 'L')).toBe(500);
  expect(parseQty('0.5', 'dozen')).toBe(6);
  expect(convertQty('24', 'pc', 'dozen')).toBe('2');
  expect(parseQty('3 packet')).toBe(3);
  expect(formatQty(1500, 'g')).toBe('1.5 kg');
  expect(formatQty(1005, 'g')).toBe('1.005 kg');
  expect(lineAmount(250, 5200, 1000)).toBe(1300);
  expect(lineAmount(500, 16500, 1000)).toBe(8250);
  expect(lineAmount(3, 1000, 1)).toBe(3000);
  expect(amountToQuantity(5000, 5200, 1000)).toEqual({
    qtyBase: 961,
    suggestedQtyBase: 960,
    suggestedAmountPaise: 4992,
  });
  expect(quantityImplausible(25001, { maxQtyBase: 25000 })).toBe(true);
});
it('rejects incompatible units, sub-base fractions, unsafe values and impossible exact conversions', () => {
  for (const call of [
    () => parseQty('0.1', 'pc'),
    () => parseQty('0.0001', 'kg'),
    () => parseQty('-1', 'g'),
    () => parseQty('1e20', 'kg'),
    () => parseQty('9007199254740992', 'pc'),
    () => convertQty(1, 'kg', 'L'),
    () => convertQty(1, 'pc', 'dozen'),
    () => amountToQuantity(10, 0, 1000),
    () => lineAmount(Number.MAX_SAFE_INTEGER, 2, 1),
  ])
    expect(call).toThrow(RangeError);
  expect(lineAmount(Number.MAX_SAFE_INTEGER, 2, 2)).toBe(Number.MAX_SAFE_INTEGER);
});
it('matches an independent BigInt quotient/remainder reference for 10,000 combinations', () => {
  let state = 27621;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  for (let i = 0; i < 10000; i++) {
    const size = [1, 12, 1000][next() % 3],
      quantity = next() % (size === 1 ? 1000000 : 4000000000),
      price = next() % 1000000001;
    const product = BigInt(quantity) * BigInt(price),
      divisor = BigInt(size);
    let reference = product / divisor;
    if ((product % divisor) * 2n >= divisor) reference += 1n;
    if (reference > BigInt(Number.MAX_SAFE_INTEGER))
      expect(() => lineAmount(quantity, price, size)).toThrow(RangeError);
    else expect(lineAmount(quantity, price, size)).toBe(Number(reference));
  }
});
