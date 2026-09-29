// Pure domain logic: no Astro/Zod imports (so Vitest exercises this without Astro).
import { DEFAULT_LOCALE, LOCALES, isLocale } from './locales';
import type { Locale } from './locales';

/**
 * Splits a pathname into its non-empty segments, ignoring leading/trailing slashes, so
 * `/es/projects/x/`, `/es/projects/x` and `es/projects/x/` all normalize the same way.
 */
function segmentsOf(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

/**
 * Rebuilds a pathname from segments in Astro's default directory build format: `/` for no
 * segments, otherwise a leading and trailing slash around the joined segments.
 */
function pathFromSegments(segments: string[]): string {
  return segments.length > 0 ? `/${segments.join('/')}/` : '/';
}

/**
 * Strips a non-default locale prefix, if the first path segment is one, returning the
 * locale-neutral rest of the path in the canonical (slash-terminated) form.
 */
function withoutLocalePrefix(pathname: string): string {
  const segments = segmentsOf(pathname);
  const [first, ...rest] = segments;

  if (first && isLocale(first) && first !== DEFAULT_LOCALE) {
    return pathFromSegments(rest);
  }

  return pathFromSegments(segments);
}

/**
 * The locale a pathname belongs to under this site's routing (`prefixDefaultLocale: false`):
 * the default locale is unprefixed, every other locale is prefixed with its code as a whole
 * path segment (so `/escape/` is never mistaken for the `es` prefix).
 */
export function localeOfPathname(pathname: string): Locale {
  const [first] = segmentsOf(pathname);

  if (first && isLocale(first) && first !== DEFAULT_LOCALE) {
    return first;
  }

  return DEFAULT_LOCALE;
}

/**
 * The equivalent pathname in `targetLocale`, matching Astro's actual routing for this
 * config: unprefixed for the default locale, `/<locale>/...` otherwise. Idempotent (applying
 * it again with the same target locale returns the same pathname), and slash-terminated to
 * match Astro's default directory build format.
 */
export function pathnameInLocale(
  pathname: string,
  targetLocale: Locale,
): string {
  const rest = withoutLocalePrefix(pathname);

  if (targetLocale === DEFAULT_LOCALE) {
    return rest;
  }

  return rest === '/' ? `/${targetLocale}/` : `/${targetLocale}${rest}`;
}

/**
 * Whether two pathnames refer to the same page once both are normalized to this module's
 * canonical (slash-terminated) form - so `/es` and `/es/` (a missing trailing slash) compare
 * equal. Used to find the current nav item without depending on the href's trailing slash.
 */
export function pathnamesMatch(a: string, b: string): boolean {
  return pathFromSegments(segmentsOf(a)) === pathFromSegments(segmentsOf(b));
}

/**
 * Whether `pathname` belongs to the section rooted at `sectionHref`: either that exact
 * page (see `pathnamesMatch`) or one of its nested pages (e.g. a project's own detail
 * page nested under the projects list). Used to mark a top-level nav item current while
 * on one of its sub-pages, even though `pathnamesMatch` itself only matches the section's
 * own page. Both arguments are compared locale-neutral and trailing-slash-safe, the same
 * way `pathnamesMatch` is. The root ("/") has no nested pages under this definition -
 * otherwise every page would be a false-positive descendant of it - so only an exact
 * match counts as "home".
 */
export function pathnameIsWithinSection(
  pathname: string,
  sectionHref: string,
): boolean {
  const pathSegments = segmentsOf(withoutLocalePrefix(pathname));
  const sectionSegments = segmentsOf(withoutLocalePrefix(sectionHref));

  if (sectionSegments.length === 0) {
    return pathSegments.length === 0;
  }

  return sectionSegments.every(
    (segment, index) => pathSegments[index] === segment,
  );
}

export interface HreflangAlternate {
  hreflang: Locale | 'x-default';
  href: string;
}

/**
 * Absolute hreflang alternates for a pathname: one per supported locale plus `x-default`,
 * which points at the default locale's URL (the URL is this static site's source of truth;
 * there is no browser-language redirect).
 */
export function hreflangAlternates(
  pathname: string,
  site: string,
): HreflangAlternate[] {
  const origin = site.endsWith('/') ? site.slice(0, -1) : site;

  const alternates: HreflangAlternate[] = LOCALES.map((locale) => ({
    hreflang: locale,
    href: `${origin}${pathnameInLocale(pathname, locale)}`,
  }));

  alternates.push({
    hreflang: 'x-default',
    href: `${origin}${pathnameInLocale(pathname, DEFAULT_LOCALE)}`,
  });

  return alternates;
}
