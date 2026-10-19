import { z } from 'astro/zod';

import { localized } from '../../shared/i18n/localized';
import { isYearMonth, isYearMonthAtOrAfter } from './domain/year-month';

const EMPLOYMENT_TYPES = [
  'full-time',
  'part-time',
  'freelance',
  'contract',
] as const;

// 'YYYY-MM' format check, delegated to the domain's own pure predicate so the
// validation rule and the parsing rule can never drift apart.
const yearMonth = z.string().refine(isYearMonth, 'Expected format "YYYY-MM"');

/**
 * The `experience` collection's contract (port): one role held by the owner.
 * `content.config.ts` wires this to the `file()` loader.
 */
export const experienceSchema = z
  .object({
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
  })
  // Cross-field check: only meaningful once both `start` and `end` are individually
  // valid 'YYYY-MM' values, so re-check the format here rather than trust field order.
  .superRefine((entry, ctx) => {
    if (
      entry.end !== null &&
      isYearMonth(entry.start) &&
      isYearMonth(entry.end) &&
      !isYearMonthAtOrAfter(entry.end, entry.start)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['end'],
        message: `"end" ("${entry.end}") must be on or after "start" ("${entry.start}")`,
      });
    }
  });

export type Experience = z.infer<typeof experienceSchema>;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
