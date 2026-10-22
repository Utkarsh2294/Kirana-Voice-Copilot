const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function safe(value) {
  if (value < 0n || value > MAX)
    throw new RangeError('Money exceeds the non-negative safe integer range');
  return Number(value);
}

function integer(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError('Expected a non-negative safe integer');
  return BigInt(value);
}

/** Round a non-negative integer ratio half up, using exact intermediate arithmetic. */
export function mulDivRound(value, multiplier, divisor) {
  const numerator = integer(value) * integer(multiplier);
  const denominator = integer(divisor);
  if (denominator === 0n) throw new RangeError('Divisor must be positive');
  return safe((numerator * 2n + denominator) / (denominator * 2n));
}

/** Convert decimal rupees to integer paise without binary floating-point arithmetic. */
export function toPaise(rupees) {
  const match = /^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(rupees).trim());
  if (!match || String(rupees).length > 100)
    throw new RangeError('Expected non-negative decimal rupees');
  const [, whole, fraction = '', exponent = '0'] = match;
  const power = 2 + Number(exponent) - fraction.length;
  if (Math.abs(power) > 100) throw new RangeError('Decimal exponent out of range');
  const digits = BigInt(whole + fraction);
  if (power >= 0) return safe(digits * 10n ** BigInt(power));
  const divisor = 10n ** BigInt(-power);
  return safe((digits * 2n + divisor) / (divisor * 2n));
}

/** Return an exact two-decimal rupee string, suitable for an API payment amount. */
export function fromPaise(paise) {
  const value = integer(paise);
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

export function addPaise(...values) {
  return safe(values.reduce((sum, value) => sum + integer(value), 0n));
}

/** Format exact paise with Indian grouping and locale-specific currency placement. */
export function formatINR(paise, locale = 'en-IN') {
  const value = integer(paise);
  const fraction = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(value % 100n);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(value / 100n)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
}
