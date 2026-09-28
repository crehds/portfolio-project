// Pure domain logic: no Astro/Zod imports.
import type { Locale } from '../../../shared/i18n/locales';
import { parseYearMonth } from './year-month';

const PRESENT_LABEL: Record<Locale, string> = {
  en: 'Present',
  es: 'Actualidad',
};

function formatYearMonth(value: string, locale: Locale): string {
  const { year, month } = parseYearMonth(value);
  const date = new Date(Date.UTC(year, month - 1, 1));

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Formats a role's period for display, e.g. "Jan 2023 – Present" (EN) or
 * "ene 2023 – Actualidad" (ES, exact abbreviation depends on the runtime's ICU data).
 */
export function formatPeriod(
  start: string,
  end: string | null,
  locale: Locale,
): string {
  const startLabel = formatYearMonth(start, locale);
  const endLabel =
    end === null ? PRESENT_LABEL[locale] : formatYearMonth(end, locale);

  return `${startLabel} – ${endLabel}`;
}
