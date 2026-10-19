// Pure domain logic: no Astro/Zod imports.
import type { Locale } from '../../../shared/i18n/locales';
import { INTL_LOCALE_TAGS } from '../../../shared/i18n/locales';

/**
 * Formats a project's `date` (its repository's latest commit date - see the "date" rule
 * in docs/case-study-template.md) as a long, localized calendar date for display next to
 * a truthful "last updated" label.
 *
 * Pinned to UTC: `z.coerce.date()` parses the frontmatter's bare "YYYY-MM-DD" value as
 * UTC midnight, so formatting with the host's local timezone instead would silently
 * shift the displayed day for any timezone with a non-zero offset (including the owner's
 * own "Lima, Peru", UTC-5, where it would render one day early). Pinning to UTC keeps the
 * displayed date identical to the literal frontmatter value everywhere this runs (a local
 * dev machine, CI, or the Cloudflare build), regardless of the host's own timezone.
 */
export function formatProjectDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE_TAGS[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
