import { describe, expect, it } from 'vitest';
import { addPaise, formatINR, fromPaise, mulDivRound, toPaise } from './money.js';

describe('exact non-negative money', () => {
  it('rounds half a paise up and handles decimal and exponent inputs', () => {
    expect(toPaise('0.005')).toBe(1);
    expect(toPaise('1.004')).toBe(100);
    expect(toPaise(0.005)).toBe(1);
    expect(toPaise('5e-3')).toBe(1);
    expect(mulDivRound(1, 1, 2)).toBe(1);
  });
  it('handles large products with BigInt intermediates and guards result overflow', () => {
    expect(addPaise(999999999, 1)).toBe(1000000000);
    expect(mulDivRound(Number.MAX_SAFE_INTEGER, 1000, 1000)).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => addPaise(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });
  it('rejects negative, non-integer and invalid values', () => {
    for (const value of [-1, '-0.01', NaN, Infinity, '', 'abc'])
      expect(() => toPaise(value)).toThrow();
    expect(() => mulDivRound(1.1, 1, 2)).toThrow();
    expect(() => mulDivRound(1, 1, 0)).toThrow();
    expect(() => fromPaise(-1)).toThrow();
  });
  it('formats without losing paise', () => {
    expect(fromPaise(999999999)).toBe('9999999.99');
    expect(formatINR(12345678)).toBe('₹1,23,456.78');
    expect(formatINR(5)).toBe('₹0.05');
  });
});
