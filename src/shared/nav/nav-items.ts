// Pure domain logic: no Astro/Zod imports.
import type { Locale } from '../i18n/locales';
import { pathnameInLocale } from '../i18n/paths';
import type { UiDictionary } from '../i18n/ui';

export interface NavItem {
  /** Key into `UiDictionary`, so the label is always a real, typechecked translation. */
  readonly labelKey: keyof UiDictionary;
  /** The item's pathname in a given locale, in Astro's slash-terminated build format. */
  readonly href: (locale: Locale) => string;
}

/**
 * The site's primary navigation, in display order. Lists only routes that exist today
 * (the home page); later tasks (T08+) add their own pages and entries here.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { labelKey: 'navHome', href: (locale) => pathnameInLocale('/', locale) },
];
