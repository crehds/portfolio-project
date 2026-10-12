// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

import { ACTION_BODY_LIMIT_BYTES } from './src/modules/contact/form-body-limit.ts';
import { DEFAULT_LOCALE, LOCALES } from './src/shared/i18n/locales.ts';
import { SITE_URL } from './src/shared/site/site-url.ts';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
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
    // The contact form is the only Action. A body past the limit is refused before it is
    // parsed (a 413, and no provider is asked): Astro's default is 1 MiB, which would let
    // anyone make the Worker read and buffer that much per request. The limit must not
    // refuse a visitor, though. A browser sends the form urlencoded, which writes each byte
    // of a non-ASCII character as three, so a message of 5,000 characters in a script of
    // three-byte characters (CJK, Devanagari, Thai) is 45,000 bytes, and with the name, the
    // email address and a Turnstile token of 2,048 characters, each at its limit, the largest
    // submission is about 52 KB; a script of two-byte characters (Cyrillic, Greek, Arabic,
    // Hebrew) passes 32 KiB at full length. So 64 KiB. The number lives in
    // `form-body-limit.ts`, where tests keep it above what the schema's limits can produce
    // and not much above it.
    actionBodySizeLimit: ACTION_BODY_LIMIT_BYTES,
  },
});
