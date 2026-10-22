import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const root = 'apps/client/dist/';
const manifest = JSON.parse(readFileSync(`${root}.vite/manifest.json`, 'utf8'));
const files = new Set();
function collect(key) {
  const chunk = manifest[key];
  assert(chunk, `Missing build manifest entry: ${key}`);
  if (files.has(chunk.file)) return;
  files.add(chunk.file);
  for (const dependency of chunk.imports || []) collect(dependency);
}
// Include the first-run coach and asynchronously loaded drag/layout features, not just the entry.
for (const key of [
  'index.html',
  'src/pages/Bill.jsx',
  'src/components/CoachMarks.jsx',
  'src/components/motion-features.js',
])
  collect(key);
// Rollup can give a shared dynamic entry a generated manifest key.
const merchantKey = Object.keys(manifest).find((key) => manifest[key].name === 'MerchantEntry');
assert(merchantKey, 'Missing merchant application chunk');
collect(merchantKey);
const publicChunk = Object.values(manifest).find((chunk) => chunk.name === 'PublicSite');
assert(publicChunk && !files.has(publicChunk.file), 'Public pages leaked into the bill bundle');
const bytes = [...files]
  .filter((file) => file.endsWith('.js'))
  .reduce((sum, file) => sum + gzipSync(readFileSync(root + file)).byteLength, 0);
assert(
  bytes <= 180 * 1024,
  `Bill-route JS ${(bytes / 1024).toFixed(1)} KiB exceeds the 180 KiB gzip target`,
);
assert(
  !readdirSync(`${root}assets`).some((file) => /^Gallery-/.test(file)),
  'Dev gallery leaked into production',
);
for (const file of readdirSync(`${root}assets`).filter((file) => file.endsWith('.js'))) {
  assert(
    !readFileSync(`${root}assets/${file}`, 'utf8').includes('data-dev-gallery'),
    'Dev gallery markup leaked into production',
  );
}
process.stdout.write(
  `Bill-route JavaScript: ${(bytes / 1024).toFixed(1)} KiB gzip including first-run and gesture chunks. Gallery excluded.\n`,
);
