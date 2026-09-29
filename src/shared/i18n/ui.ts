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
  themeToggleLabel: 'Toggle color theme',
  skipLinkLabel: 'Skip to main content',
  primaryNavLabel: 'Primary navigation',
  navHome: 'Home',
  footerGithubLabel: 'GitHub',
  footerLinkedinLabel: 'LinkedIn',
  footerEmailLabel: 'Email',
  heroPhotoAlt: 'Portrait of',
};

export type UiDictionary = typeof en;

const es: UiDictionary = {
  siteTitle: 'Carlos Rodríguez Huerta',
  siteDescription:
    'Portafolio de Carlos Rodríguez Huerta, desarrollador web full-stack. Reconstrucción en curso.',
  rebuildNotice: 'Portafolio en reconstrucción.',
  languageSwitcherLabel: 'Selector de idioma',
  themeToggleLabel: 'Cambiar tema de color',
  skipLinkLabel: 'Saltar al contenido principal',
  primaryNavLabel: 'Navegación principal',
  navHome: 'Inicio',
  footerGithubLabel: 'GitHub',
  footerLinkedinLabel: 'LinkedIn',
  footerEmailLabel: 'Correo electrónico',
  heroPhotoAlt: 'Retrato de',
};

const dictionaries: Record<Locale, UiDictionary> = { en, es };

/** Looks up the UI dictionary for a locale. */
export function getDictionary(locale: Locale): UiDictionary {
  return dictionaries[locale];
}
