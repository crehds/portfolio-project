// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import { DEFAULT_LOCALE, LOCALES } from './src/shared/i18n/locales.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://portfolio-project.carlos15erh.workers.dev',
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    routing: {
      prefixDefaultLocale: false,
    },
  },
  // Skip the adapter under Vitest: `vitest.config.ts` reuses this config via `getViteConfig`,
  // and the Cloudflare adapter's own dev-server integration conflicts with Vitest's, failing
  // every run with "There is already a server associated with the config." Vitest always sets
  // `process.env.VITEST`, so this only affects `pnpm test`, never `astro dev/build/preview`.
  adapter: process.env.VITEST
    ? undefined
    : cloudflare({
        // Optimize images at build time for the prerendered pages instead of binding
        // Cloudflare Images, so deploys don't provision an IMAGES binding.
        imageService: 'compile',
      }),
  // The site doesn't use sessions. Disabling them keeps the adapter from declaring a
  // SESSION KV binding, so deploys don't provision a KV namespace.
  session: false,
});
