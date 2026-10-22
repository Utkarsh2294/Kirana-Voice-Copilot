import { z } from 'zod';
import { baseUnits } from './units.js';
import { uiLanguageCodes } from './languages.js';

export const paiseSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const quantitySchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const baseUnitSchema = z.enum(baseUnits);
export const languageSchema = z.enum(uiLanguageCodes);
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  messageKey: z.string(),
  requestId: z.string(),
});
