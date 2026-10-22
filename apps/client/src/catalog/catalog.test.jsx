import 'fake-indexeddb/auto';
import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { App } from '../App.jsx';
import { PreferencesProvider } from '../components/PreferencesProvider.jsx';
import { usePreferences } from '../preferences.js';
import { setAccessToken } from '../api.js';
import { readCatalogCache, writeCatalogCache, clearCatalogCache } from './cache.js';
import i18n from '../i18n.js';

const id = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const initial = {
  id,
  catalogItemId: id,
  merchantItemId: null,
  slug: 'rice',
  names: { en: 'Rice', hi: 'चावल' },
  aliases: [{ lang: 'en', text: 'chawal' }],
  category: 'staples',
  baseUnit: 'g',
  unit: 'kg',
  priceUnit: 'kg',
  unitSize: 1000,
  allowedUnits: ['kg', 'g'],
  pricePaise: 5200,
  savedPricePaise: null,
  costPricePaise: null,
  priceSource: 'demo',
  packSizes: [],
  nameReview: { en: 'machine' },
  maxQtyBase: 25000,
  hidden: false,
  favourite: false,
};
const merchant = {
  id: 'catalog-ui-test',
  storeName: 'Test catalog store',
  ownerName: 'Test owner',
  uiLanguage: 'en-IN',
  voiceLanguage: 'hi-IN',
  voicePreference: 'female',
  onboardingStep: 4,
  status: 'active',
  settings: { theme: 'dark', haptics: false, earcons: false },
};
let items, offline, requests;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = vi.fn();
  usePreferences.setState({ theme: 'dark', language: 'en-IN', reduceMotion: true, tourSeen: true });
  await i18n.changeLanguage('en-IN');
  setAccessToken(null);
  await clearCatalogCache(merchant.id);
  await clearCatalogCache('another-store');
  items = [structuredClone(initial)];
  offline = false;
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      if (url.endsWith('/auth/refresh'))
        return json({ accessToken: 'test-catalog-token', merchant });
      if (offline) throw new Error('offline');
      if (url.includes('/merchant-items?')) return json({ items: structuredClone(items) });
      const body = options.body ? JSON.parse(options.body) : null;
      requests.push({ url, body });
      if (url.endsWith('/merchant-items/custom')) {
        const item = {
          ...initial,
          id: 'bbbbbbbbbbbbbbbbbbbbbbb2',
          catalogItemId: null,
          names: { en: body.name },
          category: 'custom',
          unit: body.unit,
          baseUnit: body.unit === 'pc' ? 'pc' : 'g',
          priceUnit: body.unit,
          unitSize: body.unit === 'pc' ? 1 : 1000,
          allowedUnits: body.unit === 'pc' ? ['pc', 'dozen', 'packet'] : ['kg', 'g'],
          pricePaise: body.savedPricePaise,
          savedPricePaise: body.savedPricePaise,
          priceSource: 'merchant',
          favourite: body.favourite || false,
        };
        items.push(item);
        return json({ item }, 201);
      }
      if (options.method === 'PUT') {
        const item = items.find((item) => url.endsWith(item.id));
        Object.assign(item, body);
        if (body.savedPricePaise !== undefined) {
          item.pricePaise = body.savedPricePaise;
          item.priceSource = 'merchant';
        }
        return json({ item: structuredClone(item) });
      }
      return json({ status: 'pending' }, 202);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
function open() {
  return render(
    <MemoryRouter initialEntries={['/catalog']}>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </MemoryRouter>,
  );
}

it('searches an alias, saves a merchant price, favourites and hides the item, with accessible controls', async () => {
  const user = userEvent.setup();
  const { container } = open();
  await screen.findByRole('button', { name: 'View Rice' }, { timeout: 10000 });
  await user.type(screen.getByRole('searchbox', { name: 'Search catalog' }), 'chawal');
  expect(screen.getByRole('button', { name: 'View Rice' })).toBeInTheDocument();
  expect(
    (await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations.map(
      (issue) => issue.id,
    ),
  ).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'View Rice' }));
  const dialog = await screen.findByRole('dialog');
  const price = within(dialog).getByRole('textbox', { name: 'Price in rupees per kg' });
  await user.clear(price);
  await user.type(price, '60.00');
  await user.click(within(dialog).getByRole('switch', { name: 'Keep in favourites' }));
  await user.click(within(dialog).getByRole('button', { name: 'Save item' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(requests.at(-1).body).toMatchObject({ savedPricePaise: 6000, favourite: true });
  expect(screen.getByRole('heading', { name: 'Always within reach' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View Rice' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('switch', { name: 'Hide this item' }),
  );
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save item' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'View Rice' })).not.toBeInTheDocument(),
  );
  await user.click(screen.getByRole('checkbox', { name: 'Show hidden items' }));
  expect(screen.getByRole('button', { name: 'View Rice' })).toBeInTheDocument();
}, 20000);

it('creates a custom item without publishing it to the shared catalog', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole('button', { name: 'View Rice' }, { timeout: 10000 });
  await user.click(screen.getByRole('button', { name: 'Add custom item' }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByRole('textbox', { name: 'Item name' }), 'Test local grain');
  await user.type(within(dialog).getByRole('textbox', { name: 'Price in rupees per kg' }), '72.00');
  await user.click(within(dialog).getByRole('button', { name: 'Add to my catalog' }));
  expect(await screen.findByRole('button', { name: 'View Test local grain' })).toBeInTheDocument();
  expect(requests.filter((request) => request.url.includes('/nominate'))).toHaveLength(0);
}, 15000);

it('uses the tenant cache for offline search and disables writes', async () => {
  await writeCatalogCache(merchant.id, [initial]);
  offline = true;
  const user = userEvent.setup();
  open();
  expect(
    await screen.findByText(
      'Cached catalog · Search is available. Changes need a connection.',
      {},
      { timeout: 10000 },
    ),
  ).toBeInTheDocument();
  await user.type(screen.getByRole('searchbox', { name: 'Search catalog' }), 'चावल');
  expect(screen.getByRole('button', { name: 'View Rice' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add custom item' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Favourite Rice' })).toBeDisabled();
  expect(requests).toHaveLength(0);
}, 15000);

it('keeps cached prices separate per merchant and clears only the signed-out store', async () => {
  await writeCatalogCache(merchant.id, [initial]);
  await writeCatalogCache('another-store', [{ ...initial, pricePaise: 8700 }]);
  expect((await readCatalogCache(merchant.id)).items[0].pricePaise).toBe(5200);
  await clearCatalogCache(merchant.id);
  expect(await readCatalogCache(merchant.id)).toBeNull();
  expect((await readCatalogCache('another-store')).items[0].pricePaise).toBe(8700);
});
