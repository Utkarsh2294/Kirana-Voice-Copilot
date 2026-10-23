import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App.jsx';
import { PreferencesProvider } from '../components/PreferencesProvider.jsx';
import { usePreferences } from '../preferences.js';
import { setAccessToken } from '../api.js';
import { useDraftBill } from './draft.js';
import i18n from '../i18n.js';

const id = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const merchant = {
  id: 'pricing-ui-store',
  storeName: 'Test prices',
  ownerName: 'Test owner',
  uiLanguage: 'en-IN',
  voiceLanguage: 'hi-IN',
  voicePreference: 'female',
  onboardingStep: 4,
  status: 'active',
  settings: { theme: 'dark', haptics: false, earcons: false },
};
const item = {
  id,
  catalogItemId: id,
  names: { en: 'Rice', hi: 'चावल' },
  aliases: [{ lang: 'en', text: 'chawal' }],
  baseUnit: 'g',
  priceUnit: 'kg',
  unit: 'kg',
  unitSize: 1000,
  pricePaise: 5500,
  priceSource: 'market',
  allowedUnits: ['kg', 'g'],
  category: 'staples',
  favourite: true,
  hidden: false,
};
let saved, writes;
const quote = () => ({
  itemId: id,
  pricePerBasePaise: saved ?? 5500,
  source: saved == null ? 'market' : 'merchant',
  unit: 'kg',
  unitSize: 1000,
  confidence: 0.7,
  asOf: '2026-10-23T00:00:00Z',
  demo: saved == null,
  nudges: [],
});
beforeEach(async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = vi.fn();
  usePreferences.setState({ theme: 'dark', language: 'en-IN', reduceMotion: true, tourSeen: true });
  await i18n.changeLanguage('en-IN');
  setAccessToken(null);
  useDraftBill.getState().clear();
  saved = null;
  writes = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      let body;
      if (url.endsWith('/auth/refresh')) body = { accessToken: 'fake-pricing-token', merchant };
      else if (url.endsWith('/merchant-items')) body = { items: [{ ...item, pricing: quote() }] };
      else if (url.endsWith('/pricing/resolve')) body = { prices: [quote()] };
      else if (url.includes('/pricing/history/')) body = { own: [], market: [] };
      else if (url.endsWith('/price')) {
        const input = JSON.parse(options.body);
        writes.push(input);
        saved = input.undoOf ? null : input.savedPricePaise;
        body = { price: quote(), undoId: 'bbbbbbbbbbbbbbbbbbbbbbb2' };
      } else throw new Error('Unexpected test request');
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});
function open() {
  render(
    <MemoryRouter initialEntries={['/bill']}>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </MemoryRouter>,
  );
}
const counter = () => within(screen.getByRole('region', { name: 'Current bill' }));
async function fresh(user) {
  await user.click(screen.getByRole('button', { name: 'New bill', exact: true }));
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'New bill',
      exact: true,
    }),
  );
}
it('keeps an in-bill unit-price edit out of persistent prices and resolves the next draft afresh', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Add Rice' }, { timeout: 10000 }));
  expect(await counter().findByText('₹55.00')).toBeInTheDocument();
  await user.click(counter().getByRole('button', { name: 'Edit Rice' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.clear(dialog.getByRole('textbox', { name: 'Unit price / kg' }));
  await user.type(dialog.getByRole('textbox', { name: 'Unit price / kg' }), '69');
  await user.click(dialog.getByRole('button', { name: 'This bill only' }));
  expect(counter().getByText('₹69.00')).toBeInTheDocument();
  expect(writes).toEqual([]);
  await fresh(user);
  await user.click(screen.getByRole('button', { name: 'Add Rice' }));
  expect(await counter().findByText('₹55.00')).toBeInTheDocument();
  expect(writes).toEqual([]);
}, 20000);
it('saves a unit price for future drafts and offers an undo for the saved change', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Add Rice' }, { timeout: 10000 }));
  await user.click(counter().getByRole('button', { name: 'Edit Rice' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.clear(dialog.getByRole('textbox', { name: 'Unit price / kg' }));
  await user.type(dialog.getByRole('textbox', { name: 'Unit price / kg' }), '60');
  await user.click(dialog.getByRole('button', { name: 'Save as my price' }));
  expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument();
  expect(writes[0]).toEqual({ savedPricePaise: 6000 });
  await fresh(user);
  await user.click(screen.getByRole('button', { name: 'Add Rice' }));
  expect(await counter().findByText('₹60.00')).toBeInTheDocument();
}, 20000);
