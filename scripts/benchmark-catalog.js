import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createCatalogSearch } from '@kirana/shared/catalog-search';

const items = JSON.parse(readFileSync('apps/server/src/data/catalog.json', 'utf8'));
globalThis.gc?.();
const before = process.memoryUsage().heapUsed;
const started = performance.now();
const index = createCatalogSearch(items);
const buildMs = performance.now() - started;
globalThis.gc?.();
const heapBytes = Math.max(0, process.memoryUsage().heapUsed - before);
const queries = [
  'rice',
  'chawal',
  'चावल',
  'அரிசி',
  'milk',
  'doodh',
  'tel',
  'sarson',
  'soap',
  'vegetable',
  'shampoo',
  'biscuit',
  'tea',
  'tamatar',
  'aata',
  'jaggery',
  'pasta',
  'diaper',
  'pencil',
  'masala',
  'onion',
  'curd',
  'coffee',
  'handwash',
];
for (const query of queries) index.search(query);
const timings = [];
for (let i = 0; i < 240; i++) {
  const start = performance.now();
  index.search(queries[i % queries.length]);
  timings.push(performance.now() - start);
}
timings.sort((a, b) => a - b);
const p95Ms = timings[Math.ceil(timings.length * 0.95) - 1];
const result = {
  items: items.length,
  queries: timings.length,
  buildMs: Number(buildMs.toFixed(2)),
  p95Ms: Number(p95Ms.toFixed(3)),
  indexHeapMiB: Number((heapBytes / 1024 / 1024).toFixed(3)),
  gcAvailable: Boolean(globalThis.gc),
  runtime: process.version,
  platform: process.platform,
  scope: 'In-process index search; excludes HTTP, database, and network latency.',
};
assert(p95Ms < 30, `Search p95 ${p95Ms.toFixed(2)}ms exceeds 30ms target`);
assert(heapBytes < 40 * 1024 * 1024, 'Index heap exceeds 40 MiB target');
for (const query of ['rice', 'chawal', 'चावल']) assert.equal(index.search(query)[0].slug, 'rice');
if (process.argv.includes('--write'))
  writeFileSync('docs/catalog-benchmark.json', JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
