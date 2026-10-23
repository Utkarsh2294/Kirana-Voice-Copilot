import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
test('fake microphone passes through VAD and authenticated PCM gateway; playback caches and interrupts', async ({
  page,
}) => {
  const pageErrors = [],
    requests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) =>
    requests.push({ url: request.url(), headers: request.headers(), body: request.postData() }),
  );
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Mobile number', exact: true }).fill('9000000999');
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await page.getByLabel('Code digit 1', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await page.waitForURL('**/bill');
  await page.goto('/dev/voice');
  await page.getByRole('heading', { name: 'Voice lab', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByTestId('lab-transcript')).toHaveText('One kilogram of rice.', {
    timeout: 60000,
  });
  await expect(
    page.getByText('Voice capture only. Words do not add items or save a sale yet.').first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Read text', exact: true }).click();
  await expect(page.getByTestId('voice-cache')).toHaveText('miss');
  await page.getByRole('button', { name: 'Stop voice', exact: true }).first().click();
  await page.getByRole('button', { name: 'Read text', exact: true }).click();
  await expect(page.getByTestId('voice-cache')).toHaveText('browser');
  // Starting capture must synchronously interrupt output; controlled microphone contains only fixture audio.
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop voice', exact: true })).toHaveCount(1);
  await expect(page.getByTestId('lab-transcript')).toHaveText('One kilogram of rice.', {
    timeout: 60000,
  });
  await page
    .getByLabel('Test a short audio file', { exact: true })
    .setInputFiles(resolve('tests/browser/fixtures/onion.wav'));
  await expect(page.getByTestId('lab-transcript')).toHaveText('One kilogram of rice.');
  await expect(page.getByLabel('Test a short audio file', { exact: true })).toBeEnabled();
  expect(requests.every((request) => !request.url.includes('sarvam.ai'))).toBe(true);
  expect(JSON.stringify(requests)).not.toContain('controlled-provider-server-only');
  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: 'test-results/phase-06-voice-browser.png', fullPage: true });
});
