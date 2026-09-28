import { z } from 'astro/zod';

import { localized } from '../../shared/i18n/localized';

const EMPLOYMENT_TYPES = [
  'full-time',
  'part-time',
  'freelance',
  'contract',
] as const;

// 'YYYY-MM' format check. Kept inline for now; T04's second commit extracts the pure
// `isYearMonth` predicate into `domain/year-month.ts` and this schema switches to it.
const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected format "YYYY-MM"');

/**
 * The `experience` collection's contract (port): one role held by the owner.
 * `content.config.ts` wires this to the `file()` loader.
 */
export const experienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  companyUrl: z.url().optional(),
  role: localized(z.string()),
  type: z.enum(EMPLOYMENT_TYPES),
  location: localized(z.string()).optional(),
  start: yearMonth,
  end: yearMonth.nullable(),
  highlights: localized(z.array(z.string())),
  stack: z.array(z.string()),
});

export type Experience = z.infer<typeof experienceSchema>;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
