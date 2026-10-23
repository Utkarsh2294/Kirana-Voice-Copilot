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
// Measure each real/sample bill independently, including first-run and gesture chunks.
const merchantKey = Object.keys(manifest).find((key) => manifest[key].name === 'MerchantEntry');
assert(merchantKey, 'Missing merchant application chunk');
const totals = [];
for (const route of ['Bill', 'PriceBill']) {
  files.clear();
  for (const key of [
    'index.html',
    'src/components/CoachMarks.jsx',
    'src/components/motion-features.js',
    merchantKey,
  ])
    collect(key);
  const routeKey = Object.keys(manifest).find((key) => manifest[key].name === route);
  assert(routeKey, `Missing ${route} route`);
  collect(routeKey);
  const bytes = [...files]
    .filter((file) => file.endsWith('.js'))
    .reduce((sum, file) => sum + gzipSync(readFileSync(root + file)).byteLength, 0);
  assert(
    bytes <= 180 * 1024,
    `${route} initial JS ${(bytes / 1024).toFixed(1)} KiB exceeds 180 KiB gzip`,
  );
  totals.push(`${route}: ${(bytes / 1024).toFixed(1)} KiB`);
}
const publicChunk = Object.values(manifest).find((chunk) => chunk.name === 'PublicSite');
assert(publicChunk && !files.has(publicChunk.file), 'Public pages leaked into the bill bundle');
assert(
  !readdirSync(`${root}assets`).some((file) => /^(Gallery|VoiceHarness)-/.test(file)),
  'Dev gallery or voice lab leaked into production',
);
for (const file of readdirSync(`${root}assets`).filter((file) => file.endsWith('.js'))) {
  assert(
    !readFileSync(`${root}assets/${file}`, 'utf8').includes('data-dev-gallery'),
    'Dev gallery markup leaked into production',
  );
}
process.stdout.write(
  `Bill-route JavaScript including first-run and gesture chunks: ${totals.join('; ')}. Gallery excluded.\n`,
);
