import comingEn from './locales/en-IN/coming-soon.json';
import comingHi from './locales/hi-IN/coming-soon.json';
import pricingEn from './pricing/en.json';
import pricingHi from './pricing/hi.json';
import catalogEn from './catalog/en.json';
import catalogHi from './catalog/hi.json';
import phoneEn from './locales/en-IN/phone.json';
import phoneHi from './locales/hi-IN/phone.json';
import demoCatalogEn from './locales/en-IN/demo-catalog.json';
import demoCatalogHi from './locales/hi-IN/demo-catalog.json';
import settingsEn from './locales/en-IN/settings.json';
import settingsHi from './locales/hi-IN/settings.json';
import { expect, it } from 'vitest';
import en from './locales/en-IN/common.json';
import hi from './locales/hi-IN/common.json';
import i18n, { selectLanguage } from './i18n.js';
import galleryEn from './locales/en-IN/gallery.json';
import galleryHi from './locales/hi-IN/gallery.json';
import insightsEn from './locales/en-IN/insights.json';
import insightsHi from './locales/hi-IN/insights.json';
import authEn from './auth/en.json';
import authHi from './auth/hi.json';

function paths(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && !Array.isArray(value)
      ? paths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}
it('has complete English and Hindi common keys', () => {
  expect(paths(hi).sort()).toEqual(paths(en).sort());
  for (const [english, hindi] of [
    [galleryEn, galleryHi],
    [insightsEn, insightsHi],
    [authEn, authHi],
    [catalogEn, catalogHi],
    [pricingEn, pricingHi],
    [comingEn, comingHi],
    [phoneEn, phoneHi],
    [demoCatalogEn, demoCatalogHi],
    [settingsEn, settingsHi],
  ])
    expect(paths(hindi).sort()).toEqual(paths(english).sort());
});

it('loads script resources on demand and keeps the last language selection', async () => {
  await Promise.all([selectLanguage('ta-IN'), selectLanguage('hi-IN')]);
  expect(i18n.language).toBe('hi-IN');
  expect(i18n.t('bill.total')).toBe('कुल राशि');
  await selectLanguage('en-IN');
  expect(i18n.t('bill.lineCount', { count: 1, formattedCount: '1' })).toBe('1 bill line');
});
