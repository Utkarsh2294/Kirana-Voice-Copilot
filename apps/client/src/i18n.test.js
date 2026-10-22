import { expect, it } from 'vitest';
import en from './locales/en-IN/common.json';
import hi from './locales/hi-IN/common.json';

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
