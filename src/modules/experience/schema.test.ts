import { describe, expect, it } from 'vitest';

import { experienceSchema } from './schema';

const validEntry = {
  id: 'acme-inc',
  company: 'Acme Inc.',
  role: { en: 'Software Engineer', es: 'Ingeniero de software' },
  type: 'full-time',
  start: '2023-01',
  end: null,
  highlights: { en: ['Shipped X'], es: ['Lanzó X'] },
  stack: ['typescript', 'astro'],
};

describe('experienceSchema', () => {
  it('accepts a valid entry with a present-day role (end: null)', () => {
    expect(() => experienceSchema.parse(validEntry)).not.toThrow();
  });

  it('accepts a valid entry with a closed end date', () => {
    expect(() =>
      experienceSchema.parse({ ...validEntry, end: '2024-06' }),
    ).not.toThrow();
  });

  it('rejects an invalid start date format', () => {
    expect(() =>
      experienceSchema.parse({ ...validEntry, start: '2023/01' }),
    ).toThrow();
  });

  it('rejects an invalid end date format', () => {
    expect(() =>
      experienceSchema.parse({ ...validEntry, end: '2024-13' }),
    ).toThrow();
  });

  it('accepts an entry where end equals start (a single-month role)', () => {
    expect(() =>
      experienceSchema.parse({
        ...validEntry,
        start: '2023-01',
        end: '2023-01',
      }),
    ).not.toThrow();
  });

  it('rejects an entry whose end precedes start, with a message on the end path', () => {
    const result = experienceSchema.safeParse({
      ...validEntry,
      start: '2023-06',
      end: '2023-01',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const endIssue = result.error.issues.find(
        (issue) => issue.path.join('.') === 'end',
      );
      expect(endIssue).toBeDefined();
      expect(endIssue?.message.length).toBeGreaterThan(0);
    }
  });

  it('rejects an invalid employment type', () => {
    expect(() =>
      experienceSchema.parse({ ...validEntry, type: 'internship' }),
    ).toThrow();
  });

  it('rejects an invalid companyUrl', () => {
    expect(() =>
      experienceSchema.parse({ ...validEntry, companyUrl: 'not-a-url' }),
    ).toThrow();
  });
});
