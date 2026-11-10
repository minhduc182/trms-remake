import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/acceptance/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: externalBaseUrl || 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1366, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1366, height: 800 } },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : [
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
