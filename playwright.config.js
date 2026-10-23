import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  use: {
    baseURL: 'http://localhost:5174',
    browserName: 'chromium',
    headless: true,
    permissions: ['microphone'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${resolve('tests/browser/fixtures/rice.wav')}`,
      ],
    },
  },
  webServer: [
    {
      command: 'node scripts/voice-browser-server.js',
      url: 'http://127.0.0.1:3101/readyz',
      timeout: 180000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -w @kirana/client -- --port 5174',
      url: 'http://localhost:5174',
      env: {
        VITE_DEV_API_TARGET: 'http://127.0.0.1:3101',
        VITE_API_URL: '/api/v1',
        VITE_WS_URL: 'http://localhost:5174',
      },
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
