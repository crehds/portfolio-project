// Pure domain logic: no Astro/Zod imports.
import { parseYearMonth, yearMonthToIndex } from './year-month';

export interface SortableExperience {
  /** 'YYYY-MM' */
  start: string;
  /** 'YYYY-MM', or null while the role is ongoing. */
  end: string | null;
}

function startIndex(entry: SortableExperience): number {
  return yearMonthToIndex(parseYearMonth(entry.start));
}

function endIndex(entry: SortableExperience): number {
  // Only called when `entry.end` is known to be non-null (see `compare` below).
  return yearMonthToIndex(parseYearMonth(entry.end as string));
}

function compare(a: SortableExperience, b: SortableExperience): number {
  const aCurrent = a.end === null;
  const bCurrent = b.end === null;

  if (aCurrent !== bCurrent) {
    return aCurrent ? -1 : 1;
  }

  if (!aCurrent && !bCurrent) {
    const endDiff = endIndex(b) - endIndex(a);
    if (endDiff !== 0) {
      return endDiff;
    }
  }

  return startIndex(b) - startIndex(a);
}

/** Orders roles: current roles first, then by end date desc, then by start date desc. */
export function sortExperience<T extends SortableExperience>(
  entries: T[],
): T[] {
  return [...entries].sort(compare);
}
