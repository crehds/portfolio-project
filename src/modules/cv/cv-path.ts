// Pure: no Astro, Cloudflare or Zod imports, so Vitest exercises it directly.
import type { Locale } from '../../shared/i18n/locales';

/**
 * The object key a locale's CV is stored under in the R2 bucket. The owner uploads one
 * PDF per locale under exactly this name (see docs/contact-setup.md).
 */
export function cvObjectKey(locale: Locale): string {
  return `${locale}.pdf`;
}

/**
 * The site path that serves a locale's CV: `src/pages/cv/[locale].pdf.ts` answers it by
 * reading `cvObjectKey(locale)` from the bucket. The profile `cv` field must hold exactly
 * this value (`src/modules/profile/schema.ts` enforces it), so the link on the home page
 * can never point at a route that does not exist.
 */
export function cvPath(locale: Locale): string {
  return `/cv/${cvObjectKey(locale)}`;
}

/**
 * The file name the browser saves the CV under. Plain ASCII, so it fits in a quoted
 * `Content-Disposition` filename without encoding or escaping.
 */
export function cvDownloadName(locale: Locale): string {
  return `Carlos-Rodriguez-Huerta-CV-${locale.toUpperCase()}.pdf`;
}
