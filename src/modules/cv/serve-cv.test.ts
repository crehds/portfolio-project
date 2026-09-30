import { afterEach, describe, expect, it, vi } from 'vitest';

import { serveCv, type CvBucket, type CvObject } from './serve-cv';

const PDF_TEXT = '%PDF-1.4 fixture body';
const ETAG = '"5d41402abc4b2a76b9719d911017c592"';
const CV_URL = 'https://example.com/cv/en.pdf';

function streamOf(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** R2 hands back the object with a body when the preconditions hold... */
function servedObject(): CvObject & { body: ReadableStream } {
  return { httpEtag: ETAG, body: streamOf(PDF_TEXT) };
}

/** ...and the bare object, without a body, when one of them fails. */
function bareObject(): CvObject {
  return { httpEtag: ETAG };
}

function fakeBucket(result: CvObject | null) {
  return { get: vi.fn<CvBucket['get']>().mockResolvedValue(result) };
}

function requestWith(headers: Record<string, string> = {}): Request {
  return new Request(CV_URL, { headers });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('serveCv: serving the file', () => {
  it('streams the object body with a 200', async () => {
    const object = servedObject();

    const response = await serveCv({
      locale: 'en',
      bucket: fakeBucket(object),
      request: requestWith(),
    });

    expect(response.status).toBe(200);
    expect(response.body).toBe(object.body);
    expect(await response.text()).toBe(PDF_TEXT);
  });

  it('reads the object named after the locale', async () => {
    const bucket = fakeBucket(servedObject());

    await serveCv({ locale: 'es', bucket, request: requestWith() });

    expect(bucket.get).toHaveBeenCalledTimes(1);
    expect(bucket.get.mock.calls[0][0]).toBe('es.pdf');
  });

  it('hands the request headers to R2 as the preconditions', async () => {
    const bucket = fakeBucket(servedObject());
    const request = requestWith({ 'If-None-Match': '"abc"' });

    await serveCv({ locale: 'en', bucket, request });

    // `toBe`, not `toEqual`: two `Headers` objects always compare equal structurally.
    expect(bucket.get.mock.calls[0][1].onlyIf).toBe(request.headers);
  });

  it('sets the PDF content type itself instead of trusting the upload metadata', async () => {
    const response = await serveCv({
      locale: 'en',
      bucket: fakeBucket(servedObject()),
      request: requestWith(),
    });

    expect(response.headers.get('Content-Type')).toBe('application/pdf');
  });

  it.each([
    ['en', 'Carlos-Rodriguez-Huerta-CV-EN.pdf'],
    ['es', 'Carlos-Rodriguez-Huerta-CV-ES.pdf'],
  ])('downloads the %s CV as a named attachment', async (locale, fileName) => {
    const response = await serveCv({
      locale,
      bucket: fakeBucket(servedObject()),
      request: requestWith(),
    });

    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="${fileName}"`,
    );
  });

  it('exposes the ETag, a revalidating cache policy and noindex', async () => {
    const response = await serveCv({
      locale: 'en',
      bucket: fakeBucket(servedObject()),
      request: requestWith(),
    });

    expect(response.headers.get('ETag')).toBe(ETAG);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=300, must-revalidate',
    );
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
  });
});

describe('serveCv: a failed precondition', () => {
  it.each([
    ['If-None-Match', ETAG],
    ['If-Modified-Since', 'Wed, 01 Jan 2020 00:00:00 GMT'],
  ])('answers 304 for a request with %s', async (header, value) => {
    const response = await serveCv({
      locale: 'en',
      bucket: fakeBucket(bareObject()),
      request: requestWith({ [header]: value }),
    });

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
  });

  it('gives the 304 the ETag and Cache-Control a 200 carries', async () => {
    const served = await serveCv({
      locale: 'en',
      bucket: fakeBucket(servedObject()),
      request: requestWith(),
    });
    const notModified = await serveCv({
      locale: 'en',
      bucket: fakeBucket(bareObject()),
      request: requestWith({ 'If-None-Match': ETAG }),
    });

    expect(notModified.headers.get('ETag')).toBe(ETAG);
    expect(notModified.headers.get('Cache-Control')).toBe(
      'public, max-age=300, must-revalidate',
    );
    // A cache that stores the 304's headers must see the same values as the 200's.
    expect(notModified.headers.get('ETag')).toBe(served.headers.get('ETag'));
    expect(notModified.headers.get('Cache-Control')).toBe(
      served.headers.get('Cache-Control'),
    );
  });

  // Only `If-Match` and `If-Unmodified-Since` can fail on a request that is not a
  // revalidation, and RFC 9110 answers those with 412, not 304.
  it.each([
    ['If-Match', '"something-else"'],
    ['If-Unmodified-Since', 'Wed, 01 Jan 2020 00:00:00 GMT'],
  ])('answers 412 for a request with only %s', async (header, value) => {
    const response = await serveCv({
      locale: 'en',
      bucket: fakeBucket(bareObject()),
      request: requestWith({ [header]: value }),
    });

    expect(response.status).toBe(412);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  // R2 reports only that some precondition failed. With both kinds on one request the
  // route cannot tell which one, and answers for the revalidation.
  it('answers 304 when a revalidation and an If-Match arrive together', async () => {
    const response = await serveCv({
      locale: 'en',
      bucket: fakeBucket(bareObject()),
      request: requestWith({
        'If-Match': '"something-else"',
        'If-None-Match': ETAG,
      }),
    });

    expect(response.status).toBe(304);
  });
});

describe('serveCv: nothing to serve', () => {
  it.each(['fr', 'EN', '', 'en.pdf', '../es', '__proto__'])(
    'answers 404 without reading the bucket for the locale %j',
    async (locale) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const bucket = fakeBucket(servedObject());

      const response = await serveCv({
        locale,
        bucket,
        request: requestWith(),
      });

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(bucket.get).not.toHaveBeenCalled();
    },
  );

  it('answers 404 when the route has no locale param', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await serveCv({
      locale: undefined,
      bucket: fakeBucket(servedObject()),
      request: requestWith(),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers 404 when the bucket binding is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await serveCv({
      locale: 'en',
      bucket: undefined,
      request: requestWith(),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers 404 when the object is missing from the bucket', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await serveCv({
      locale: 'en',
      bucket: fakeBucket(null),
      request: requestWith(),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  // Astro swaps a 404 with a null body for the site's error page. A body keeps the
  // route's own plain-text answer, the same in dev, preview and production.
  it('gives every 404 a body so the framework keeps the response', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const responses = await Promise.all([
      serveCv({
        locale: 'fr',
        bucket: fakeBucket(null),
        request: requestWith(),
      }),
      serveCv({ locale: 'en', bucket: undefined, request: requestWith() }),
      serveCv({
        locale: 'en',
        bucket: fakeBucket(null),
        request: requestWith(),
      }),
    ]);

    for (const response of responses) {
      expect(response.body).not.toBeNull();
    }
  });
});

describe('serveCv: logging', () => {
  it('warns about an unknown locale', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await serveCv({
      locale: 'fr',
      bucket: fakeBucket(null),
      request: requestWith(),
    });

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reports a missing binding as an error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await serveCv({
      locale: 'en',
      bucket: undefined,
      request: requestWith(),
    });

    expect(error).toHaveBeenCalledTimes(1);
  });

  it('reports a missing object as an error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await serveCv({
      locale: 'es',
      bucket: fakeBucket(null),
      request: requestWith(),
    });

    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).toContain('es.pdf');
  });

  it('never logs a header value', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const request = requestWith({
      Authorization: 'Bearer top-secret-token',
      Cookie: 'session=top-secret-cookie',
      'If-None-Match': '"top-secret-etag"',
    });

    await serveCv({ locale: 'fr', bucket: fakeBucket(null), request });
    await serveCv({ locale: 'en', bucket: undefined, request });
    await serveCv({ locale: 'en', bucket: fakeBucket(null), request });

    // Each call above logs exactly once; without this the assertion below could pass
    // just because nothing was logged.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(2);

    const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
    expect(logged).not.toContain('top-secret');
  });
});
