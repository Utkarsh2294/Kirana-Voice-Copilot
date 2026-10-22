// Explicit Phase 2 fixtures, never returned by the API or written as sales.
export const sampleItems = [
  { id: 'rice', unit: 'kg', size: 1000, pricePaise: 5200, tone: 'amber', category: 'staples' },
  { id: 'milk', unit: 'L', size: 1000, pricePaise: 6800, tone: 'blue', category: 'dairy' },
  { id: 'oil', unit: 'L', size: 1000, pricePaise: 16500, tone: 'amber', category: 'pantry' },
  { id: 'sugar', unit: 'kg', size: 1000, pricePaise: 4600, tone: 'blue', category: 'staples' },
  { id: 'tea', unit: 'pc', size: 1, pricePaise: 14500, tone: 'green', category: 'pantry' },
  { id: 'atta', unit: 'kg', size: 1000, pricePaise: 4200, tone: 'amber', category: 'staples' },
  { id: 'soap', unit: 'pc', size: 1, pricePaise: 1000, tone: 'rose', category: 'care' },
  { id: 'biscuits', unit: 'pc', size: 1, pricePaise: 1000, tone: 'amber', category: 'pantry' },
];
export const itemById = Object.fromEntries(sampleItems.map((item) => [item.id, item]));
export const initialSampleLines = [
  { id: 'rice', qtyBase: 1500, pricePaise: 5200, source: 'demo' },
  { id: 'milk', qtyBase: 1000, pricePaise: 6800, source: 'demo' },
  { id: 'oil', qtyBase: 500, pricePaise: 16500, source: 'demo' },
];
export const samplePeriods = {
  day: { revenue: 1284500, bills: 42, average: 30583, points: [24, 48, 30, 65, 45, 90], trend: 12 },
  week: {
    revenue: 8376200,
    bills: 285,
    average: 29390,
    points: [45, 60, 42, 65, 81, 95],
    trend: 8,
  },
  month: {
    revenue: 34285600,
    bills: 1156,
    average: 29659,
    points: [50, 45, 70, 60, 88, 95],
    trend: 16,
  },
};
