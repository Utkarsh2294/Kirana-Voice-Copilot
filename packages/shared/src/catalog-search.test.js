import { expect, it } from 'vitest';
import { createCatalogSearch } from './catalog-search.js';

it('ranks equal text by this store’s cached sales frequency, then recency', () => {
  const items = [
    { id: 'a', names: { en: 'Rice' }, salesFrequency30d: 1, lastSoldAt: '2026-10-22' },
    { id: 'b', names: { en: 'Rice' }, salesFrequency30d: 2, lastSoldAt: '2026-10-20' },
    { id: 'c', names: { en: 'Rice' }, salesFrequency30d: 2, lastSoldAt: '2026-10-21' },
  ];
  const index = createCatalogSearch(items);
  expect(index.search('Rice').map((item) => item.id)).toEqual(['c', 'b', 'a']);
  expect(
    index.search('Rice', { stats: new Map([['a', { frequency: 3 }]]) }).map((item) => item.id),
  ).toEqual(['a', 'c', 'b']);
});
