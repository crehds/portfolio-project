// Pure domain logic: no Astro imports (so Vitest exercises this without Astro).

/**
 * Where the sitemap index lives: the name `@astrojs/sitemap` gives it (its default
 * `filenameBase`, which `astro.config.mjs` leaves alone), at the root of the site.
 */
const SITEMAP_INDEX_PATH = '/sitemap-index.xml';

/**
 * The body of `robots.txt`: every crawler may fetch everything, and the sitemap index is
 * named by its absolute URL, which is the only form the `Sitemap` line allows.
 *
 * Nothing is disallowed on purpose. The `/cv/<locale>.pdf` routes answer with
 * `X-Robots-Tag: noindex`, and a crawler that is not allowed to fetch a URL never reads
 * that header, so a `Disallow: /cv/` would hide the very signal that keeps the PDFs out of
 * the index. The 404 pages say `noindex` in their markup for the same reason.
 *
 * `site` is an absolute URL, with or without a trailing slash (`SITE_URL` or
 * `Astro.site.href`). The line is built from its origin: a `robots.txt` only counts at the
 * root of a host. A value that is not an absolute URL throws.
 */
export function buildRobotsTxt(site: string): string {
  const sitemap = new URL(SITEMAP_INDEX_PATH, site).href;

  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${sitemap}`, ''].join(
    '\n',
  );
}
