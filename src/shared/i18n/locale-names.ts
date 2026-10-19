// Pure domain logic: no Astro/Zod imports.
import type { Locale } from './locales';

/**
 * Each locale's own name for itself (endonym), used by the language switcher. These are
 * never translated: "English" and "Español" read the same regardless of the page's locale.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};
