// Pure domain logic: no Astro/Zod imports. `src/modules/experience/schema.ts` (the port)
// reuses `isYearMonth` to validate the 'YYYY-MM' format at the content boundary.

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface YearMonth {
  year: number;
  /** 1-12 */
  month: number;
}

export function isYearMonth(value: string): boolean {
  return YEAR_MONTH_PATTERN.test(value);
}

export function parseYearMonth(value: string): YearMonth {
  if (!isYearMonth(value)) {
    throw new Error(
      `Invalid year-month value: "${value}". Expected format "YYYY-MM".`,
    );
  }

  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

/** A monotonically increasing index (0 = month 1 of year 0) usable to compare or subtract months. */
export function yearMonthToIndex(value: YearMonth): number {
  return value.year * 12 + (value.month - 1);
}
