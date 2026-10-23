import { it, expect } from 'vitest';
import {
  buildBillReadback,
  buildInsightReadback,
  buildSetupReadback,
  voiceGreetings,
} from './readback.js';
it('reads current fractional quantities and exact totals in the chosen spoken language', () => {
  const text = buildBillReadback({
    lines: [{ id: 'rice', qtyBase: 500, unitSize: 1000, unit: 'kg', pricePaise: 4200 }],
    items: [{ id: 'rice', names: { en: 'Rice', hi: 'चावल' } }],
    total: 2100,
    lang: 'hi-IN',
  });
  expect(text).toContain('चावल. 0.5 किलोग्राम. 21 रुपये');
  expect(text).toContain('कुल. 21 रुपये');
  expect(text).not.toContain('Rice');
});
it('provides draft guidance and explicit sample insight readback for all eleven output languages', () => {
  expect(Object.keys(voiceGreetings)).toHaveLength(11);
  for (const lang of Object.keys(voiceGreetings)) {
    expect(buildSetupReadback({ step: 3, lang }).length).toBeGreaterThan(20);
    const text = buildInsightReadback({
      data: { revenue: 123400, bills: 10, average: 12340 },
      lang,
    });
    expect(text).toContain(new Intl.NumberFormat(lang).format(1234));
    expect(text).not.toContain('undefined');
  }
});
