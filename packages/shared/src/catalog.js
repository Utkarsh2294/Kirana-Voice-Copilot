import { z } from 'zod';
import { baseUnits, unitBase, unitSize } from './units.js';
import { paiseSchema, quantitySchema } from './schemas.js';

export const catalogLanguages = ['en', 'hi', 'bn', 'ta', 'te', 'gu', 'kn', 'ml', 'mr', 'pa', 'od'];
export const categories = [
  'staples',
  'oils',
  'spices',
  'dairy',
  'bakery',
  'snacks',
  'beverages',
  'personal-care',
  'home-care',
  'packaged-foods',
  'baby-care',
  'stationery',
  'vegetables',
];
export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i)
  .toLowerCase();
const names = z
  .object(Object.fromEntries(catalogLanguages.map((code) => [code, z.string().min(1).max(200)])))
  .strict();
export const catalogItemSchema = z
  .object({
    _id: objectIdSchema,
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(160),
    names,
    aliases: z
      .array(z.object({ lang: z.string().max(20), text: z.string().min(1).max(200) }).strict())
      .max(100),
    category: z.enum(categories),
    subcategory: z.string().max(80),
    brand: z.string().max(100),
    kind: z.enum(['loose', 'packed']),
    baseUnit: z.enum(baseUnits),
    allowedUnits: z.array(z.enum(Object.keys(unitSize))).min(1),
    packSizes: z
      .array(
        z
          .object({ label: z.string().max(60), qtyBase: quantitySchema, mrpPaise: paiseSchema })
          .strict(),
      )
      .max(30),
    defaultPricePaise: paiseSchema,
    priceClass: z.enum(['commodity', 'packaged']),
    mrpPaise: paiseSchema.nullable(),
    gstRate: z.number().min(0).max(100).nullable(),
    barcode: z
      .string()
      .regex(/^(?:\d{8}|\d{12,14})$/)
      .optional(),
    icon: z.string().max(80),
    tags: z.array(z.string().max(80)).max(30),
    active: z.boolean(),
    nameReview: z
      .object(
        Object.fromEntries(catalogLanguages.map((code) => [code, z.enum(['machine', 'reviewed'])])),
      )
      .strict(),
    nameMethods: z
      .object(Object.fromEntries(catalogLanguages.map((code) => [code, z.string().max(80)])))
      .strict(),
    priceProvenance: z.enum(['synthetic', 'reviewed']),
    maxQtyBase: quantitySchema,
  })
  .strict()
  .refine((item) => item.allowedUnits.every((unit) => unitBase[unit] === item.baseUnit), {
    message: 'Allowed units must use the item base unit',
  });
export const merchantItemPatchSchema = z
  .object({
    hidden: z.boolean().optional(),
    favourite: z.boolean().optional(),
    unit: z.enum(Object.keys(unitSize)).optional(),
    savedPricePaise: paiseSchema.nullable().optional(),
    costPricePaise: paiseSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export const customItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    unit: z.enum(['kg', 'L', 'pc']),
    kind: z.enum(['loose', 'packed']),
    savedPricePaise: paiseSchema,
    costPricePaise: paiseSchema.nullable().optional(),
    favourite: z.boolean().optional(),
  })
  .strict();
