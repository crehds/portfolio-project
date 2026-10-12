import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentSecurityPolicy } from '../src/shared/security/headers';
import { expect, test } from './support/contact-test';

// Every script that runs inline must have its hash in the policy of the page that carries
// it, or the browser blocks it. The hashes in `src/shared/security/headers.ts` are written
// by hand from the three `is:inline` scripts, so this is what catches a script that was
// edited (its hash is stale), one that was added, and a script Astro or Vite started to
// inline on its own. It reads the built pages in `dist/client` (so it needs a build, like
// the rest of the e2e suite) and asks the Worker for the two pages that are not prerendered.
// A `<script type="application/ld+json">` is a data block: the browser never runs it, and
// the policy does not apply to it.

const DIST = fileURLToPath(new URL('../dist/client', import.meta.url));
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;

function htmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return htmlFiles(path);
    }
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

const sha256 = (text: string) =>
  `sha256-${createHash('sha256').update(text).digest('base64')}`;

interface Scripts {
  /** The hash of every inline script that runs. */
  inline: string[];
  /** The `src` of every external script. */
  external: string[];
}

function scriptsOf(html: string): Scripts {
  const scripts: Scripts = { inline: [], external: [] };

  for (const [, attributes = '', body = ''] of html.matchAll(SCRIPT)) {
    const src = /\ssrc="([^"]*)"/.exec(attributes)?.[1];
    if (src !== undefined) {
      scripts.external.push(src);
    } else if (!/type="application\/ld\+json"/.test(attributes)) {
      scripts.inline.push(sha256(body));
    }
  }

  return scripts;
}

/** Fails with the hash a missing script needs, so the fix is a paste. */
function expectEveryInlineScriptHashed(html: string, policy: string): void {
  for (const hash of scriptsOf(html).inline) {
    expect(
      policy,
      `an inline script has no hash in the policy; add '${hash}' (docs/security-headers.md)`,
    ).toContain(`'${hash}'`);
  }
}

const pages = htmlFiles(DIST);

test.describe('the built pages', () => {
  test('are found', () => {
    // The home pages, the lists, the details and the 404s of both locales (18 today).
    expect(pages.length).toBeGreaterThanOrEqual(18);
  });

  for (const page of pages) {
    const name = page.slice(DIST.length).replaceAll('\\', '/');

    test(`${name}: every inline script has its hash in the page policy`, () => {
      const html = readFileSync(page, 'utf8');

      expectEveryInlineScriptHashed(html, contentSecurityPolicy('page'));
    });

    test(`${name}: loads no script from another origin and has no inline event handler`, () => {
      const html = readFileSync(page, 'utf8');

      for (const src of scriptsOf(html).external) {
        expect(src, 'a script src').toMatch(/^\/(?!\/)/);
      }
      expect(html).not.toMatch(/\son[a-z]+\s*=\s*["']/i);
    });
  }
});

test.describe('the contact pages, which the Worker renders', () => {
  for (const path of ['/contact/', '/es/contact/']) {
    test(`${path}: every inline script has its hash in the policy the response carries`, async ({
      request,
    }) => {
      const response = await request.get(path);
      const html = await response.text();
      const policy = response.headers()['content-security-policy'] ?? '';

      expect(policy).toBe(contentSecurityPolicy('contact'));
      expectEveryInlineScriptHashed(html, policy);
    });

    test(`${path}: loads only Turnstile from another origin, and the policy allows it`, async ({
      request,
    }) => {
      const response = await request.get(path);
      const { external } = scriptsOf(await response.text());
      const policy = response.headers()['content-security-policy'] ?? '';
      const foreign = external.filter((src) => !src.startsWith('/'));

      expect(foreign).toEqual([
        'https://challenges.cloudflare.com/turnstile/v0/api.js',
      ]);
      expect(policy).toContain('https://challenges.cloudflare.com');
    });
  }
});
