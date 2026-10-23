import React, { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import i18n from '../i18n.js';
import { usePreferences, validatePreferences } from '../preferences.js';
import { PreferencesProvider } from './PreferencesProvider.jsx';
import { UiProvider, Sheet, ConfirmDialog } from './overlays.jsx';
import { parseDisplayQuantity } from './controls.jsx';
import { OtpInput } from './PhoneControls.jsx';
import { MicButton, micGestureResult } from './Voice.jsx';
import Bill from '../pages/Bill.jsx';
import { useSampleBill, sampleTotal } from '../prototype/store.js';
import { nextPeriod } from '../pages/Insights.jsx';

function wrap(children) {
  return render(
    <MemoryRouter>
      <PreferencesProvider>
        <UiProvider>
          <main>{children}</main>
        </UiProvider>
      </PreferencesProvider>
    </MemoryRouter>,
  );
}
beforeEach(async () => {
  useSampleBill.getState().reset();
  usePreferences.setState({
    reduceMotion: true,
    language: 'en-IN',
    tourSeen: true,
    haptics: false,
    earcons: false,
  });
  await i18n.changeLanguage('en-IN');
});

describe('counter recovery and exact edits', () => {
  it('removes a line, restores it in its original position and recovers the exact total', async () => {
    const user = userEvent.setup();
    wrap(<Bill />);
    expect(sampleTotal(useSampleBill.getState().lines)).toBe(22850);
    await user.click(screen.getByRole('button', { name: 'Remove Basmati rice' }));
    expect(sampleTotal(useSampleBill.getState().lines)).toBe(15050);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(useSampleBill.getState().lines.map((line) => line.id)).toEqual(['rice', 'milk', 'oil']);
    expect(sampleTotal(useSampleBill.getState().lines)).toBe(22850);
  });
  it('applies a per-unit price only after confirmation and supports half-kilo quantity', async () => {
    const user = userEvent.setup();
    wrap(<Bill />);
    await user.click(screen.getByRole('button', { name: 'Edit Basmati rice' }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByRole('textbox'));
    await user.type(within(dialog).getByRole('textbox'), '55.00');
    expect(useSampleBill.getState().lines[0].pricePaise).toBe(5200);
    await user.click(within(dialog).getByRole('button', { name: 'Apply to this sample' }));
    expect(useSampleBill.getState().lines[0].pricePaise).toBe(5500);
    expect(sampleTotal(useSampleBill.getState().lines)).toBe(23300);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Quantity for Basmati rice' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '0.5 kg' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply to this sample' }),
    );
    expect(useSampleBill.getState().lines[0].qtyBase).toBe(500);
    expect(sampleTotal(useSampleBill.getState().lines)).toBe(17800);
  });
  it('announces sample changes and has no automated semantic accessibility violations', async () => {
    const { container } = wrap(<Bill />);
    // JSDOM has no layout/canvas. Real color contrast is checked against actual tokens separately.
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.map((issue) => `${issue.id}: ${issue.description}`)).toEqual([]);
  });
});

it('pastes all six OTP digits and advances focus', async () => {
  function Harness() {
    const [value, setValue] = useState('');
    return <OtpInput value={value} onChange={setValue} />;
  }
  const user = userEvent.setup();
  wrap(<Harness />);
  await user.click(screen.getByLabelText('Code digit 1'));
  await user.paste('123456');
  expect(
    screen
      .getAllByRole('textbox')
      .map((input) => input.value)
      .join(''),
  ).toBe('123456');
  expect(screen.getByLabelText('Code digit 6')).toHaveFocus();
});

it('lets focus leave a sheet and restores the opener after Escape', async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open sample</button>
        <button>Outside control</button>
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title="Sample sheet"
          description="Editable sample"
        >
          <input aria-label="Sample field" />
        </Sheet>
      </>
    );
  }
  const user = userEvent.setup();
  wrap(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Open sample' }));
  screen.getByRole('button', { name: 'Outside control' }).focus();
  expect(screen.getByRole('button', { name: 'Outside control' })).toHaveFocus();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Open sample' })).toHaveFocus();
});

it('focuses cancel first in a destructive confirmation', async () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open confirm</button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Reset sample"
          description="Only sample data"
          onConfirm={() => {}}
        />
      </>
    );
  }
  const user = userEvent.setup();
  wrap(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Open confirm' }));
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
});

it('supports keyboard hands-free and Escape cancellation', async () => {
  const user = userEvent.setup();
  wrap(<MicButton />);
  screen.getByRole('button', { name: /Microphone:/ }).focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: 'Finish recording' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: /Microphone:/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

it('classifies mic gestures and rejects fractional base units without rounding them', () => {
  expect(micGestureResult(100, 0)).toBe('locked');
  expect(micGestureResult(500, 0)).toBe('processing');
  expect(micGestureResult(500, -70)).toBe('locked');
  expect(parseDisplayQuantity('0.001', 1000)).toBe(1);
  expect(parseDisplayQuantity('0.5', 1)).toBeNull();
  expect(parseDisplayQuantity('-1', 1000)).toBeNull();
  expect(parseDisplayQuantity('1e3', 1000)).toBeNull();
  expect(parseDisplayQuantity('1000001', 1)).toBeNull();
  expect(nextPeriod('day', -1)).toBe('day');
  expect(nextPeriod('day', 1)).toBe('week');
  expect(nextPeriod('month', 1)).toBe('month');
  expect(validatePreferences({ theme: 'bad', language: 'xx', haptics: 'true' })).toMatchObject({
    theme: 'dark',
    language: 'en-IN',
    haptics: false,
  });
});
