import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:4321';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // In CI the workflow's own Build step already produced dist/; only start the preview
    // server there instead of building a second time. Locally, build then preview.
    command: process.env.CI ? 'pnpm preview' : 'pnpm build && pnpm preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
