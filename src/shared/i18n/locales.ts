/**
 * Supported UI/content locales. English is the default and is served at `/`;
 * Spanish is served at `/es/` (see the i18n routing task, T05).
 */
export type Locale = 'en' | 'es';

export const LOCALES: readonly Locale[] = ['en', 'es'];

export const DEFAULT_LOCALE: Locale = 'en';

/** Narrows an arbitrary string (e.g. a parsed content id segment) to a supported `Locale`. */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * BCP 47 locale tags for every `Intl` date/number formatter in the codebase, keyed by
 * this site's own `Locale`. Pinned to a neutral regional variant rather than the bare
 * language subtag, so every formatter renders identical CLDR data regardless of which
 * regional variant a given runtime's locale data happens to default to: `es-419` (Latin
 * American Spanish) spells September "septiembre", while a country-specific variant like
 * `es-PE` overrides it to "setiembre" and adds a trailing dot to every short-month
 * abbreviation. `format-project-date.ts` and `format-period.ts` both format Spanish
 * dates - see the T09b entry in odd/tasks/portfolio-astro-rebuild.md - so they import
 * this one map instead of each pinning (or forgetting to pin) their own tag.
 */
export const INTL_LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-419',
};
