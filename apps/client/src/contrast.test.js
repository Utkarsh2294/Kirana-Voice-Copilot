import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('apps/client/src/tokens.css', 'utf8');
const blocks = css.split(":root[data-theme='day']");
function tokens(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{3,6});/gi)].map(([, key, value]) => [key, value]),
  );
}
function luminance(hex) {
  let value = hex.slice(1);
  if (value.length === 3)
    value = value
      .split('')
      .map((char) => char + char)
      .join('');
  const [r, g, b] = value.match(/../g).map((channel) => {
    const scaled = parseInt(channel, 16) / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
for (const [index, block] of blocks.entries()) {
  it(`passes AA text and non-text control contrast in ${index ? 'day' : 'dark'} tokens`, () => {
    const colors = { ...tokens(blocks[0]), ...tokens(block) };
    for (const surface of ['bg', 'surface-1', 'surface-2', 'surface-3']) {
      for (const text of [
        'text',
        'text-2',
        'primary-text',
        'accent-text',
        'success',
        'warning',
        'danger',
      ])
        expect(
          contrast(colors[text], colors[surface]),
          `${text} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors['border-control'], colors[surface])).toBeGreaterThanOrEqual(3);
    }
    expect(contrast('#ffffff', colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', colors['primary-hover'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors['on-accent'], colors.accent)).toBeGreaterThanOrEqual(4.5);
  });
}
