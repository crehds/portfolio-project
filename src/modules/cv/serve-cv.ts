// Pure: no `cloudflare:*` or `astro:*` import. The structural types below are all this
// needs from Cloudflare, so Vitest drives it with a fake bucket and the route
// (`src/pages/cv/[locale].pdf.ts`) only wires the real R2 binding in.
import { isLocale } from '../../shared/i18n/locales';
import { cvDownloadName, cvObjectKey } from './cv-path';

/** What the route reads from an R2 object; `R2Object` and `R2ObjectBody` both fit. */
export interface CvObject {
  readonly httpEtag: string;
  /**
   * Present only when every request precondition held. When one fails, R2 still
   * resolves `get()` with the object, but without a body.
   */
  readonly body?: ReadableStream;
}

/** What the route needs from the bucket binding; the real `R2Bucket` fits. */
export interface CvBucket {
  get(key: string, options: { onlyIf: Headers }): Promise<CvObject | null>;
}

export interface ServeCvInput {
  /** The `[locale]` route param as it came in the URL, not yet validated. */
  locale: string | undefined;
  /** The bound bucket, or `undefined` when the binding is not configured. */
  bucket: CvBucket | undefined;
  request: Request;
}

// Five minutes at the edge and in browsers, then always revalidate with the ETag. The
// owner replaces the PDF in R2 without a deploy, so a new upload is live within five
// minutes and a revalidation of an unchanged file costs a 304, not the whole PDF.
const CACHE_CONTROL = 'public, max-age=300, must-revalidate';

/**
 * A short plain-text response that is never cached, so one bad answer cannot outlive
 * the owner's fix (uploading the missing PDF). It always carries a body: Astro replaces
 * an empty 404 or 500 with the site's error page, so without one the answer would change
 * between `astro dev`, preview and production (and become an HTML document at a `.pdf`
 * URL once the site has 404 pages).
 */
function uncached(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/** The one answer for every reason this route has no file to serve. */
function notFound(): Response {
  return uncached(404, 'Not found');
}

/** Quoted and cut short, because the value comes straight from the URL. */
function describeLocale(locale: string | undefined): string {
  return locale === undefined ? 'none' : JSON.stringify(locale.slice(0, 32));
}

/**
 * Whether the request revalidates a copy the client already holds (`If-None-Match` or
 * `If-Modified-Since`). RFC 9110 answers a failed precondition of those two with 304
 * Not Modified and a failed `If-Match` or `If-Unmodified-Since` with 412. R2 does not say
 * which precondition failed, so a request that carries both kinds gets the 304.
 */
function isRevalidation(headers: Headers): boolean {
  return headers.has('If-None-Match') || headers.has('If-Modified-Since');
}

/**
 * Answers a `/cv/<locale>.pdf` request from the R2 bucket: the locale's PDF as an
 * attachment, or 304 when the visitor's cached copy is still current. Logs a line per
 * failure and never a header value.
 */
export async function serveCv({
  locale,
  bucket,
  request,
}: ServeCvInput): Promise<Response> {
  if (locale === undefined || !isLocale(locale)) {
    console.warn(
      `cv: no CV for the requested locale ${describeLocale(locale)}`,
    );
    return notFound();
  }

  if (!bucket) {
    console.error('cv: the CV_BUCKET binding is not configured');
    return notFound();
  }

  const key = cvObjectKey(locale);
  const object = await bucket.get(key, { onlyIf: request.headers });

  if (object === null) {
    console.error(`cv: ${key} is missing from the bucket`);
    return notFound();
  }

  if (!object.body) {
    if (isRevalidation(request.headers)) {
      return new Response(null, {
        status: 304,
        headers: { ETag: object.httpEtag, 'Cache-Control': CACHE_CONTROL },
      });
    }

    return uncached(412, 'Precondition failed');
  }

  return new Response(object.body, {
    headers: {
      // Explicit, so a wrong content type on the upload cannot change how it downloads.
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cvDownloadName(locale)}"`,
      ETag: object.httpEtag,
      'Cache-Control': CACHE_CONTROL,
      'X-Robots-Tag': 'noindex',
    },
  });
}
