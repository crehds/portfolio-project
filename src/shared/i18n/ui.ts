// Pure domain logic: no Astro/Zod imports.
import type { Locale } from './locales';

/**
 * The site's UI dictionary (port): English is the reference shape, so `UiDictionary` is
 * derived from it below and the Spanish dictionary fails typecheck if a key is missing or
 * added without a translation. Keep this minimal: only what T05 renders. Language names are
 * endonyms (see `locale-names.ts`) and never go through this dictionary.
 */
const en = {
  siteTitle: 'Carlos Rodríguez Huerta',
  siteDescription:
    'Portfolio of Carlos Rodríguez Huerta, full-stack web developer. Rebuild in progress.',
  rebuildNotice: 'Portfolio rebuild in progress.',
  languageSwitcherLabel: 'Language switcher',
};

export type UiDictionary = typeof en;

const es: UiDictionary = {
  siteTitle: 'Carlos Rodríguez Huerta',
  siteDescription:
    'Portafolio de Carlos Rodríguez Huerta, desarrollador web full-stack. Reconstrucción en curso.',
  rebuildNotice: 'Portafolio en reconstrucción.',
  languageSwitcherLabel: 'Selector de idioma',
};

const dictionaries: Record<Locale, UiDictionary> = { en, es };

/** Looks up the UI dictionary for a locale. */
export function getDictionary(locale: Locale): UiDictionary {
  return dictionaries[locale];
}
