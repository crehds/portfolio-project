import { describe, expect, it } from 'vitest';

import { formatYearsOfExperience } from './format-years-of-experience';

describe('formatYearsOfExperience', () => {
  it('reads as "N+ years of experience" in English for a typical value', () => {
    expect(formatYearsOfExperience(6, 'en')).toBe('6+ years of experience');
  });

  it('reads as "Más de N años de experiencia" in Spanish for a typical value', () => {
    expect(formatYearsOfExperience(6, 'es')).toBe(
      'Más de 6 años de experiencia',
    );
  });

  it('uses the singular "year" in English for exactly one year', () => {
    expect(formatYearsOfExperience(1, 'en')).toBe('1+ year of experience');
  });

  it('uses the singular "año" in Spanish for exactly one year', () => {
    expect(formatYearsOfExperience(1, 'es')).toBe(
      'Más de 1 año de experiencia',
    );
  });

  it('reads as a distinct exact phrase in English below a full year', () => {
    // `yearsOfExperience` floors a fractional duration, so a positive result never
    // claims an exact amount ("+"/"Más de" always means "at least this many"). Zero is
    // different: it is not "0 or more" (trivially true) but a genuinely exact case, so
    // it gets its own phrasing instead of "0+ years of experience".
    expect(formatYearsOfExperience(0, 'en')).toBe(
      'Less than a year of experience',
    );
  });

  it('reads as a distinct exact phrase in Spanish below a full year', () => {
    expect(formatYearsOfExperience(0, 'es')).toBe(
      'Menos de un año de experiencia',
    );
  });
});
