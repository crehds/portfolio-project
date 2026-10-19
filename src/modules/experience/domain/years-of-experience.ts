// Pure domain logic: no Astro/Zod imports.
import { parseYearMonth, yearMonthToIndex } from './year-month';

export interface ExperiencePeriod {
  /** 'YYYY-MM' */
  start: string;
  /** 'YYYY-MM', or null while the role is ongoing. */
  end: string | null;
}

type IndexRange = [start: number, end: number];

function toIndexRange(period: ExperiencePeriod, now: Date): IndexRange {
  const start = yearMonthToIndex(parseYearMonth(period.start));
  const end = period.end
    ? yearMonthToIndex(parseYearMonth(period.end))
    : now.getUTCFullYear() * 12 + now.getUTCMonth();

  return [start, end];
}

/**
 * A range is inverted when its end precedes its start. This normally means an invalid
 * `end < start` entry (rejected by the schema before it can reach here), but it can
 * also happen legitimately for a `null`-end (ongoing) role whose `start` is after `now`.
 * Either way, such a range describes no real coverage and must contribute 0 months
 * rather than a negative number.
 */
function isValidRange([start, end]: IndexRange): boolean {
  return end >= start;
}

function mergeRanges(ranges: IndexRange[]): IndexRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: IndexRange[] = [];

  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}

/**
 * Total years of experience across possibly overlapping roles, counted from whole
 * months and rounded down. Overlapping (or touching) periods are merged first so a
 * shared month is never counted twice. A `null` end means "ongoing" as of `now`.
 */
export function yearsOfExperience(
  entries: ExperiencePeriod[],
  now: Date = new Date(),
): number {
  if (entries.length === 0) {
    return 0;
  }

  const ranges = entries
    .map((entry) => toIndexRange(entry, now))
    .filter(isValidRange);

  if (ranges.length === 0) {
    return 0;
  }

  const merged = mergeRanges(ranges);
  const totalMonths = merged.reduce(
    (sum, [start, end]) => sum + (end - start + 1),
    0,
  );

  return Math.floor(totalMonths / 12);
}
