import { expect, test } from '@playwright/test';

// `/cv/<locale>.pdf` streams the owner's CV out of the R2 bucket bound as `CV_BUCKET`.
// These tests run against the local bucket that `pnpm e2e:seed` fills before the preview
// server starts (see `webServer.command` in playwright.config.ts) with the synthetic
// fixtures in e2e/fixtures: single-page PDFs that hold nothing but a marker string, so a
// test can tell which locale's file it got. The real CVs never enter the repository.
const cvs = [
  {
    locale: 'en',
    marker: 'PORTFOLIO-CV-FIXTURE-EN',
    otherMarker: 'PORTFOLIO-CV-FIXTURE-ES',
    fileName: 'Carlos-Rodriguez-Huerta-CV-EN.pdf',
  },
  {
    locale: 'es',
    marker: 'PORTFOLIO-CV-FIXTURE-ES',
    otherMarker: 'PORTFOLIO-CV-FIXTURE-EN',
    fileName: 'Carlos-Rodriguez-Huerta-CV-ES.pdf',
  },
];

const REVALIDATING_CACHE = 'public, max-age=300, must-revalidate';

for (const { locale, marker, otherMarker, fileName } of cvs) {
  test.describe(`/cv/${locale}.pdf`, () => {
    test('serves the locale PDF as a named attachment', async ({ request }) => {
      // No redirects followed: i18n routing and trailing-slash handling must leave this
      // on-demand route alone, so the URL the profile links to answers directly.
      const response = await request.get(`/cv/${locale}.pdf`, {
        maxRedirects: 0,
      });

      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers['content-type']).toBe('application/pdf');
      expect(headers['content-disposition']).toBe(
        `attachment; filename="${fileName}"`,
      );
      expect(headers['x-robots-tag']).toBe('noindex');
      expect(headers['cache-control']).toBe(REVALIDATING_CACHE);
      expect(headers['etag']).toBeTruthy();

      const body = (await response.body()).toString('latin1');
      expect(body.startsWith('%PDF')).toBe(true);
      expect(body).toContain(marker);
      expect(body).not.toContain(otherMarker);
    });

    test('answers a matching If-None-Match with a 304 and no body', async ({
      request,
    }) => {
      const first = await request.get(`/cv/${locale}.pdf`);
      const etag = first.headers()['etag'];
      expect(etag).toBeTruthy();

      const revalidated = await request.get(`/cv/${locale}.pdf`, {
        headers: { 'If-None-Match': etag },
      });

      expect(revalidated.status()).toBe(304);
      expect(revalidated.headers()['etag']).toBe(etag);
      expect(revalidated.headers()['cache-control']).toBe(REVALIDATING_CACHE);
      expect(await revalidated.body()).toHaveLength(0);
    });

    test('serves the file again when If-None-Match names another version', async ({
      request,
    }) => {
      const response = await request.get(`/cv/${locale}.pdf`, {
        headers: { 'If-None-Match': '"another-version"' },
      });

      expect(response.status()).toBe(200);
      expect((await response.body()).toString('latin1')).toContain(marker);
    });

    // A date far in the future stands for "the file has not changed since then", and one
    // far in the past for "it has": neither depends on when the fixtures were seeded.
    test('answers 304 while the file is older than If-Modified-Since', async ({
      request,
    }) => {
      const response = await request.get(`/cv/${locale}.pdf`, {
        headers: { 'If-Modified-Since': 'Fri, 01 Jan 2100 00:00:00 GMT' },
      });

      expect(response.status()).toBe(304);
      expect(response.headers()['cache-control']).toBe(REVALIDATING_CACHE);
    });

    test('serves the file when it changed after If-Modified-Since', async ({
      request,
    }) => {
      const response = await request.get(`/cv/${locale}.pdf`, {
        headers: { 'If-Modified-Since': 'Sat, 01 Jan 2000 00:00:00 GMT' },
      });

      expect(response.status()).toBe(200);
      expect((await response.body()).toString('latin1')).toContain(marker);
    });

    // Link checkers probe downloads with HEAD; Astro runs the GET handler for it.
    test('answers HEAD with the same headers and no body', async ({
      request,
    }) => {
      const response = await request.head(`/cv/${locale}.pdf`);

      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers['content-type']).toBe('application/pdf');
      expect(headers['content-disposition']).toBe(
        `attachment; filename="${fileName}"`,
      );
      expect(headers['etag']).toBeTruthy();
      expect(await response.body()).toHaveLength(0);
    });

    test('answers a failed If-Match with a 412', async ({ request }) => {
      const response = await request.get(`/cv/${locale}.pdf`, {
        headers: { 'If-Match': '"another-version"' },
      });

      expect(response.status()).toBe(412);
      expect(response.headers()['cache-control']).toBe('no-store');
    });
  });
}

test.describe('/cv/<locale>.pdf for an unsupported locale', () => {
  // The route's own plain-text answer must survive the framework's error handling:
  // Astro replaces a body-less 404 with the site's error page, which is HTML.
  test('answers 404 with its own text and is never cached', async ({
    request,
  }) => {
    const response = await request.get('/cv/fr.pdf', { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(response.headers()['content-type']).toBe(
      'text/plain; charset=utf-8',
    );
    expect(await response.text()).toBe('Not found');
  });

  // The object keys are lowercase, like the locale codes; an uppercase code is not a
  // locale and must not reach the bucket.
  test('does not treat an uppercase locale code as a locale', async ({
    request,
  }) => {
    const response = await request.get('/cv/EN.pdf', { maxRedirects: 0 });

    expect(response.status()).toBe(404);
  });
});
