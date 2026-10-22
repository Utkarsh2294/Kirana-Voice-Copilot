import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { format, resolveConfig } from 'prettier';
import { buildCatalog } from '../data/catalog-build.js';

const items = buildCatalog();
assert(items.length >= 600 && items.length <= 1000);
assert(new Set(items.map((item) => item.slug)).size === items.length, 'Duplicate catalog slugs');
assert(items.every((item) => Object.keys(item.names).length === 11));
const target = new URL('../apps/server/src/data/catalog.json', import.meta.url);
await writeFile(
  target,
  await format(JSON.stringify(items), {
    ...(await resolveConfig(fileURLToPath(target))),
    parser: 'json',
  }),
);
process.stdout.write(
  `Generated ${items.length} draft items. Names and synthetic prices are unreviewed.\n`,
);
