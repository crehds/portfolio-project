import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

import { APP_ORIGIN, APP_PORT } from './e2e/support/ports';

if (process.env.CI && !existsSync(new URL('./dist', import.meta.url))) {
  throw new Error(
    `dist/ is missing. In CI, webServer only runs "pnpm preview" (it does not build, see ` +
      `webServer.command below), so the workflow's own Build step ("pnpm build") must run ` +
      `and succeed before the e2e step.`,
  );
}

const preview = `pnpm preview --port ${APP_PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Starts the fake EmailJS and Turnstile, after proving that the build under test talks
  // to them and to no real provider (e2e/support/hermetic-guard.ts).
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: APP_ORIGIN,
    trace: 'on-first-retry',
    launchOptions: {
      // Nothing a test does may leave the machine, and a page that loads Turnstile's script
      // or any other host's would: the browser resolves no host but the local ones, so such
      // a request fails at once, before any packet is sent. The contact specs answer
      // Turnstile's script themselves (e2e/support/contact-test.ts).
      args: [
        '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost , EXCLUDE 127.0.0.1',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // In CI the workflow's own Build step already produced dist/ (with CLOUDFLARE_ENV=e2e,
    // see .github/workflows/ci.yml); only start the preview server there instead of
    // building a second time. Locally, build then preview. Both seed the local R2 bucket
    // with the fixture CVs first (`pnpm e2e:seed`): the preview server runs the Worker in
    // workerd and reads the same `.wrangler/state` the seed writes, so /cv/<locale>.pdf has
    // something to serve.
    command: process.env.CI
      ? `pnpm e2e:seed && ${preview}`
      : `pnpm build && pnpm e2e:seed && ${preview}`,
    url: APP_ORIGIN,
    // Never reuse a server that is already there. This one has a port of its own, and what
    // it was started with decides which providers the contact form talks to: a leftover
    // `astro preview` or `astro dev` with a developer's own `.dev.vars` would send real
    // email. Starting a new one also rebuilds, so the build under test is this run's.
    reuseExistingServer: false,
    timeout: 120_000,
    // CLOUDFLARE_ENV=e2e makes the Cloudflare plugin read `.dev.vars.e2e` (fake and test
    // values, fake provider URLs) instead of the developer's `.dev.vars` when it builds.
    // wrangler warns that no `env.e2e` section exists, and uses the top-level config, which
    // is what is wanted: the bindings are the real ones.
    env: { CLOUDFLARE_ENV: 'e2e' },
  },
});
