import { readFileSync } from 'node:fs';

const pincodes = JSON.parse(readFileSync(new URL('./data/pincodes.json', import.meta.url), 'utf8'));
const slug = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export function resolvePincode(pincode) {
  const record = pincodes[pincode];
  const [state, district] = record || ['', ''];
  return {
    known: Boolean(record),
    location: {
      pincode,
      state,
      district,
      regionId: record ? `${slug(state)}:${slug(district)}` : `pin:${pincode.slice(0, 3)}`,
    },
  };
}
export function suggestPincode(lat, lng) {
  let closest = null;
  let distance = 0.45 ** 2;
  const scale = Math.cos((lat * Math.PI) / 180);
  for (const [pincode, record] of Object.entries(pincodes)) {
    if (record.length < 4) continue;
    const next = (lat - record[2]) ** 2 + ((lng - record[3]) * scale) ** 2;
    if (next < distance) {
      distance = next;
      closest = pincode;
    }
  }
  return closest ? resolvePincode(closest) : null;
}
