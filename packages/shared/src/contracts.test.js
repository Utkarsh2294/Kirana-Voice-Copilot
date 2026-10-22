import { expect, it } from 'vitest';
import { baseUnits, extraInputLanguages, languages, unitSize } from './index.js';
import { languageSchema, paiseSchema, quantitySchema } from './schemas.js';

it('keeps base units, display sizes and language namespaces consistent', () => {
  expect(baseUnits).toEqual(['g', 'ml', 'pc']);
  expect(unitSize).toMatchObject({ kg: 1000, L: 1000, dozen: 12 });
  expect(languages).toHaveLength(11);
  expect(new Set([...languages.map((l) => l.code), ...extraInputLanguages]).size).toBe(23);
  expect(languageSchema.safeParse('hi-IN').success).toBe(true);
  expect(paiseSchema.safeParse(0.1).success).toBe(false);
  expect(quantitySchema.safeParse(0).success).toBe(false);
});
