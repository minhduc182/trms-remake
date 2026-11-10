import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/acceptance/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @trms/api start',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'pnpm --filter @trms/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
