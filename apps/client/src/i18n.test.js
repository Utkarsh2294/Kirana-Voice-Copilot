import { expect, it } from 'vitest';
import en from './locales/en-IN/common.json';
import hi from './locales/hi-IN/common.json';
import i18n, { selectLanguage } from './i18n.js';

function paths(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && !Array.isArray(value)
      ? paths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}
it('has complete English and Hindi common keys', () => {
  expect(paths(hi).sort()).toEqual(paths(en).sort());
});

it('loads script resources on demand and keeps the last language selection', async () => {
  await Promise.all([selectLanguage('ta-IN'), selectLanguage('hi-IN')]);
  expect(i18n.language).toBe('hi-IN');
  expect(i18n.t('bill.total')).toBe('कुल राशि');
  await selectLanguage('en-IN');
  expect(i18n.t('bill.lineCount', { count: 1, formattedCount: '1' })).toBe('1 bill line');
});
