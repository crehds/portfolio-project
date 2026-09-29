// Pure domain logic: no Astro/Zod imports.
import type { Locale } from '../../../shared/i18n/locales';

const LESS_THAN_A_YEAR: Record<Locale, string> = {
  en: 'Less than a year of experience',
  es: 'Menos de un año de experiencia',
};

/**
 * Formats a whole number of years of experience - as returned by `yearsOfExperience`,
 * which floors a fractional real duration down to a whole number - into a localized
 * headline fragment.
 *
 * A positive result never claims an exact amount: someone with 6 years and 8 months
 * reads "6+ years of experience" (EN) / "Más de 6 años de experiencia" (ES), not "6
 * years" - the "+"/"Más de" always signals "at least this many, likely more". Zero is
 * different: it is not "0 or more" (trivially true and uninformative) but a genuinely
 * exact case - fewer than 12 months have been merged yet - so it gets its own phrasing
 * instead of "0+ years of experience".
 */
export function formatYearsOfExperience(years: number, locale: Locale): string {
  if (years <= 0) {
    return LESS_THAN_A_YEAR[locale];
  }

  if (locale === 'es') {
    const noun = years === 1 ? 'año' : 'años';
    return `Más de ${years} ${noun} de experiencia`;
  }

  const noun = years === 1 ? 'year' : 'years';
  return `${years}+ ${noun} of experience`;
}
