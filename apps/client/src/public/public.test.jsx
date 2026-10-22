import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { App } from '../App.jsx';
import { PreferencesProvider } from '../components/PreferencesProvider.jsx';
import { usePreferences } from '../preferences.js';
import i18n from '../i18n.js';
import en from './en.json';
import hi from './hi.json';

beforeEach(async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  usePreferences.setState({ theme: 'dark', language: 'en-IN', reduceMotion: true, tourSeen: true });
  await i18n.changeLanguage('en-IN');
});
function open(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PreferencesProvider>
        <App />
      </PreferencesProvider>
    </MemoryRouter>,
  );
}

it('opens the public home, navigates the story and reaches the existing merchant app', async () => {
  const user = userEvent.setup();
  open();
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Your shop.');
  expect(screen.queryByText('YOUR WORKSPACE')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(
    within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', {
      name: 'Our story',
    }),
  );
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
    'people behind the counter',
  );
  expect(screen.getByRole('main')).toHaveFocus();
  expect(document.title).toBe('Our story & mission | Kirana Voice Copilot');
  await user.click(screen.getAllByRole('link', { name: 'Explore the prototype' })[0]);
  expect(await screen.findByRole('heading', { name: 'Current bill' })).toBeInTheDocument();
  expect(document.title).not.toContain('Our story');
  await user.click(screen.getAllByRole('link', { name: 'Kirana website home' })[0]);
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Your shop.');
});

it('supports menu Escape, day mode, Hindi, and honest expandable answers', async () => {
  const user = userEvent.setup();
  open();
  await screen.findByRole('heading', { level: 1 });
  const menu = screen.getByRole('button', { name: 'Open menu' });
  await user.click(menu);
  expect(menu).toHaveAttribute('aria-expanded', 'true');
  await user.keyboard('{Escape}');
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(menu).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Switch to day mode' }));
  expect(document.documentElement.dataset.theme).toBe('day');
  await user.click(screen.getByText('Does this already connect to UPI or Paytm?'));
  expect(screen.getByText(/No live payment integration/).closest('details')).toHaveAttribute(
    'open',
  );
  await user.selectOptions(screen.getByLabelText('Website language'), 'hi-IN');
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('आपकी दुकान।'),
  );
  expect(document.documentElement.lang).toBe('hi-IN');
  expect(usePreferences.getState().language).toBe('hi-IN');
});

it('keeps every roadmap phase and marks only the current two foundations built', async () => {
  open('/roadmap');
  await screen.findByRole('heading', { level: 1 });
  expect(within(screen.getByRole('main')).getAllByRole('listitem')).toHaveLength(15);
  expect(screen.getAllByText('Foundation built')).toHaveLength(2);
  expect(screen.getByText('Next · not started')).toBeInTheDocument();
  expect(screen.getByText('Offline, security & privacy')).toBeInTheDocument();
});

it.each(['/', '/about', '/how-it-works', '/roadmap'])(
  'has accessible page structure at %s',
  async (path) => {
    const { container } = open(path);
    await screen.findByRole('heading', { level: 1 });
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((issue) => issue.id)).toEqual([]);
  },
);

it('has matching English/Hindi content keys, including every FAQ and phase', () => {
  function paths(value, prefix = '') {
    return Object.entries(value).flatMap(([key, item]) =>
      typeof item === 'object' ? paths(item, `${prefix}${key}.`) : [`${prefix}${key}`],
    );
  }
  expect(paths(hi).sort()).toEqual(paths(en).sort());
});
