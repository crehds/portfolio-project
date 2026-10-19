// Pure domain logic: no Astro imports (so Vitest exercises this without Astro).
import { hreflangAlternates } from '../i18n/paths';

/**
 * The part of a sitemap entry that this module reads and writes: the page's address and its
 * alternate links. `SitemapItem` of `@astrojs/sitemap` has this shape and more, so a function
 * that takes this one takes that one.
 */
export interface SitemapEntry {
  url: string;
  links?: { url: string; lang: string }[];
}

/**
 * Adds the `x-default` alternate to a sitemap entry. `@astrojs/sitemap` writes one alternate
 * per locale, from its `i18n` option, and no `x-default`; the page head declares one, so
 * without it the two would say different things about the same page.
 *
 * It is not worked out again here. The head's alternates come from `hreflangAlternates`
 * (src/shared/i18n/paths.ts), and so does this one: the sitemap says what the head says, and
 * a change to the rule (which locale `x-default` stands for) changes both.
 *
 * Only `x-default` comes from there. The locale alternates stay the integration's own, so that
 * e2e/seo.spec.ts compares two derivations of the same set instead of one function with itself,
 * and `x-default` follows them. An entry with no alternates at all, a page with no other
 * locale, is returned as it is: an `x-default` alone would point nowhere. The entry it is
 * given is never modified, and applying this twice adds the alternate once.
 */
export function withXDefaultAlternate<T extends SitemapEntry>(
  entry: T,
  site: string,
): T {
  if (!entry.links?.length) {
    return entry;
  }

  const xDefault = hreflangAlternates(new URL(entry.url).pathname, site).find(
    ({ hreflang }) => hreflang === 'x-default',
  );
  if (!xDefault) {
    throw new Error(
      `The page head has no x-default alternate for ${entry.url}.`,
    );
  }

  return {
    ...entry,
    links: [
      ...entry.links.filter(({ lang }) => lang !== 'x-default'),
      { url: xDefault.href, lang: 'x-default' },
    ],
  };
}
