// Pure domain logic: no Astro/Zod imports.
import type { Locale } from '../../../shared/i18n/locales';
import { getDictionary } from '../../../shared/i18n/ui';

/**
 * The alt text of a project's cover in a locale: the UI dictionary's label and the project's
 * title ("Screenshot of Pysa", "Captura de pantalla de Pysa Gaming"). It is the one rule for
 * every place the cover shows up, the project card, the project page and the picture of the
 * page's link preview (`og:image:alt`), so that they cannot describe the same picture in
 * different words.
 *
 * `title` is the one the caller shows in that locale (a project's title can differ by
 * locale), used as it is: this does not escape it, writing it into an attribute does.
 */
export function coverAltText(title: string, locale: Locale): string {
  return `${getDictionary(locale).projectCoverAlt} ${title}`;
}
