import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  workers: 1, // Single worker for Electron window tests
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
  },
});
