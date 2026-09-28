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
