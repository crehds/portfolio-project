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
 * (home, projects, experience, skills, contact); a later task that adds a page adds its
 * entry here.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { labelKey: 'navHome', href: (locale) => pathnameInLocale('/', locale) },
  {
    labelKey: 'navProjects',
    href: (locale) => pathnameInLocale('/projects/', locale),
  },
  {
    labelKey: 'navExperience',
    href: (locale) => pathnameInLocale('/experience/', locale),
  },
  {
    labelKey: 'navSkills',
    href: (locale) => pathnameInLocale('/skills/', locale),
  },
  {
    labelKey: 'navContact',
    href: (locale) => pathnameInLocale('/contact/', locale),
  },
];
