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
