import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { App } from '../App.jsx';
import { PreferencesProvider } from '../components/PreferencesProvider.jsx';
import { usePreferences } from '../preferences.js';
import { setAccessToken } from '../api.js';
import i18n from '../i18n.js';

beforeEach(async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = vi.fn();
  usePreferences.setState({ theme: 'dark', language: 'en-IN', reduceMotion: true, tourSeen: true });
  setAccessToken(null);
  await i18n.changeLanguage('en-IN');
});
afterEach(() => vi.unstubAllGlobals());

it('guards the workspace, signs in, and saves all four onboarding steps through the API client', async () => {
  let merchant = {
    id: 'merchant-test',
    onboardingStep: 0,
    status: 'onboarding',
    uiLanguage: 'en-IN',
    voiceLanguage: 'hi-IN',
    voicePreference: 'female',
    settings: { theme: 'dark', haptics: false, earcons: false },
  };
  const saved = [];
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      if (url.endsWith('/auth/refresh')) return json({ code: 'UNAUTHENTICATED' }, 401);
      if (url.endsWith('/auth/capabilities')) return json({ developmentOtp: true });
      if (url.endsWith('/auth/otp/request')) return json({}, 202);
      if (url.endsWith('/auth/otp/verify')) return json({ accessToken: 'test-token', merchant });
      if (options.method === 'PUT') {
        const key = url.split('/').at(-1);
        const body = JSON.parse(options.body);
        saved.push([key, body]);
        merchant = {
          ...merchant,
          ...(['store', 'language'].includes(key) ? body : { [key]: body }),
          onboardingStep: merchant.onboardingStep + 1,
        };
        if (key === 'upi') merchant.status = 'active';
        return json({ merchant });
      }
      return json({ code: 'NOT_FOUND' }, 404);
    }),
  );
  const user = userEvent.setup();
  const { container } = render(
    <MemoryRouter initialEntries={['/bill']}>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Welcome to your counter.' }, { timeout: 5000 });
  expect(
    (await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations.map(
      (issue) => issue.id,
    ),
  ).toEqual([]);
  await user.type(screen.getByRole('textbox', { name: 'Mobile number' }), '9000000002');
  await user.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  await user.click(await screen.findByRole('textbox', { name: 'Code digit 1', exact: true }));
  await user.paste('123456');
  await user.click(screen.getByRole('button', { name: 'Verify & continue' }));
  await screen.findByRole(
    'heading',
    { name: 'A language that feels like home.' },
    { timeout: 5000 },
  );
  await user.click(screen.getByRole('button', { name: 'Save & continue' }));
  await user.type(await screen.findByLabelText('Store name'), 'Test Kirana');
  await user.type(screen.getByLabelText('Owner name'), 'Test Merchant');
  await user.click(screen.getByRole('button', { name: 'Save & continue' }));
  await user.type(await screen.findByLabelText('PIN code'), '122001');
  await user.click(screen.getByRole('button', { name: 'Save & continue' }));
  await user.type(await screen.findByLabelText('UPI ID'), 'test.kirana@upi');
  await user.type(screen.getByLabelText('Payee display name'), 'Test Kirana');
  await user.click(screen.getByRole('button', { name: 'Open my workspace' }));
  expect(
    await screen.findByRole('heading', { name: 'Current bill' }, { timeout: 10000 }),
  ).toBeInTheDocument();
  expect(saved.map(([step]) => step)).toEqual(['language', 'store', 'location', 'upi']);
  expect(saved[2][1]).toEqual({ pincode: '122001' });
  expect(screen.getAllByText('Test Kirana').length).toBeGreaterThan(0);
}, 15000);
