import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { APIResponse } from '@playwright/test';

import {
  securityHeaders,
  type PolicyKind,
} from '../src/shared/security/headers';
import { ACTION_BODY_LIMIT_BYTES } from '../src/modules/contact/form-body-limit';
import { expect, retryOnProxyFailure, test } from './support/contact-test';
import { bodyOfExactly } from './support/form-bodies';

// The security headers come by two paths that this file checks as a browser would meet
// them: `public/_headers`, which Workers static assets apply to the prerendered pages and to
// every asset, and `src/middleware.ts`, which covers what the Worker generates (the contact
// pages, the Action's answer, the CV). Both read `src/shared/security/headers.ts`, so the
// expected values come from there too; the unit tests pin the values themselves.

function expectSecurityHeaders(response: APIResponse, kind: PolicyKind): void {
  const headers = response.headers();

  for (const [name, value] of securityHeaders(kind)) {
    expect(headers[name.toLowerCase()], name).toBe(value);
  }
  // Turnstile's frame could not load under it.
  expect(headers['cross-origin-embedder-policy']).toBeUndefined();
}

const assets = readdirSync(new URL('../dist/client/_astro', import.meta.url));
const stylesheet = assets.find((name) => name.endsWith('.css'));

test.describe('static pages and assets', () => {
  const paths = [
    '/',
    '/es/',
    '/projects/',
    '/es/projects/',
    '/projects/bachatealo/',
    '/skills/',
    '/es/skills/',
    '/experience/',
    '/es/experience/',
    '/robots.txt',
    '/sitemap-index.xml',
    '/icon.svg',
    '/favicon.ico',
    '/apple-touch-icon.png',
  ];

  for (const path of paths) {
    test(`${path} carries the page headers`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(200);
      expectSecurityHeaders(response, 'page');
    });
  }

  // The answer for an address with no page: the 404 page of each locale.
  for (const path of ['/no-such-page', '/es/no-such-page', '/_astro/x.js']) {
    test(`the 404 at ${path} carries the page headers`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(404);
      expectSecurityHeaders(response, 'page');
    });
  }

  test('a built asset has the headers and keeps the adapter’s immutable Cache-Control', async ({
    request,
  }) => {
    expect(stylesheet).toBeDefined();
    const response = await request.get(`/_astro/${stylesheet}`);

    expect(response.status()).toBe(200);
    expectSecurityHeaders(response, 'page');
    expect(response.headers()['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  test('the built _headers file holds both the page rule and the adapter’s Cache-Control rule', () => {
    const path = new URL('../dist/client/_headers', import.meta.url);

    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('/*\n  Content-Security-Policy: ');
    expect(text).toContain(
      '/_astro/*\n  Cache-Control: public, max-age=31536000, immutable',
    );
  });
});

test.describe('what the Worker generates', () => {
  for (const path of ['/contact/', '/es/contact/']) {
    test(`${path} carries the contact policy`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(200);
      expectSecurityHeaders(response, 'contact');
    });
  }

  test('the Action’s answer carries the contact policy, for a refusal and for a redirect', async ({
    submit,
  }) => {
    const refused = await submit({ fields: { 'cf-turnstile-response': '' } });

    expectSecurityHeaders(refused, 'contact');

    const sent = await submit();

    expect(sent.status()).toBe(303);
    expectSecurityHeaders(sent, 'contact');
    expect(sent.headers()['location']).toContain('sent=1');
  });

  test('a post the Action refuses before reading it carries the contact policy', async ({
    submit,
    marker,
  }) => {
    const body = bodyOfExactly(ACTION_BODY_LIMIT_BYTES + 1, marker);

    const response = await retryOnProxyFailure(() => submit({ body }));

    expect(response.status()).toBe(413);
    expectSecurityHeaders(response, 'contact');
  });

  for (const locale of ['en', 'es']) {
    test(`/cv/${locale}.pdf has the file policy and keeps its own headers`, async ({
      request,
    }) => {
      const response = await request.get(`/cv/${locale}.pdf`);
      const headers = response.headers();

      expect(response.status()).toBe(200);
      expectSecurityHeaders(response, 'file');
      expect(headers['content-security-policy']).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
      expect(headers['cache-control']).toBe(
        'public, max-age=300, must-revalidate',
      );
      expect(headers['content-type']).toBe('application/pdf');
      expect(headers['x-robots-tag']).toBe('noindex');
      expect(headers['etag']).toBeTruthy();
    });
  }

  test('a missing CV has the file policy too', async ({ request }) => {
    const response = await request.get('/cv/fr.pdf');

    expect(response.status()).toBe(404);
    expectSecurityHeaders(response, 'file');
    expect(response.headers()['cache-control']).toBe('no-store');
  });
});
