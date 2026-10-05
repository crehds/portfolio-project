// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

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
  vite: {
    plugins: [tailwindcss()],
  },
  // Stable since Astro 6.0 (no longer `experimental.fonts`). Both families are served
  // from this site's own origin: the Fonts API downloads and caches the provider's files
  // at build time instead of the browser fetching them from Google at request time.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Ubuntu',
      cssVariable: '--font-ubuntu',
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Ubuntu Mono',
      cssVariable: '--font-ubuntu-mono',
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'monospace'],
    },
  ],
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
  security: {
    // The contact form is the only Action. Its fields cap at 100 + 254 + 5,000 characters
    // plus a Turnstile token of at most 2,048, which a browser sends as a urlencoded body
    // well under this (a message of accented Spanish letters grows by a few KB; only a
    // message written in a three-byte script, such as Chinese, could approach it). A body
    // past the limit is refused before it is parsed: Astro's default is 1 MiB, which
    // would let anyone make the Worker read and buffer that much per request.
    actionBodySizeLimit: 32 * 1024,
  },
});
