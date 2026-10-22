import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['packages/**/*.test.js', 'apps/**/*.test.{js,jsx}'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/**/*.test.js', 'apps/server/**/*.test.js'],
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['apps/client/**/*.test.{js,jsx}'],
          setupFiles: ['./scripts/test-setup.js'],
        },
      },
    ],
    restoreMocks: true,
  },
});
