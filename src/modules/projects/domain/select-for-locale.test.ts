import { describe, expect, it } from 'vitest';

import type { ProjectEntry } from './select-for-locale';
import { selectProjectsForLocale } from './select-for-locale';

function project(
  overrides: Partial<ProjectEntry['data']> = {},
): ProjectEntry['data'] {
  return {
    title: 'Portfolio rebuild',
    summary: 'A fast, accessible Astro portfolio.',
    stack: ['astro'],
    links: {},
    featured: false,
    status: 'published',
    date: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('selectProjectsForLocale', () => {
  it('picks the entry matching the requested locale', () => {
    const entries: ProjectEntry[] = [
      { id: 'acme/en', data: project({ title: 'Acme (EN)' }) },
      { id: 'acme/es', data: project({ title: 'Acme (ES)' }) },
    ];

    const result = selectProjectsForLocale(entries, 'es');

    expect(result).toEqual([
      { slug: 'acme', locale: 'es', isFallback: false, data: entries[1].data },
    ]);
  });

  it('falls back to the default locale when the requested translation is missing', () => {
    const entries: ProjectEntry[] = [
      { id: 'acme/en', data: project({ title: 'Acme (EN)' }) },
    ];

    const result = selectProjectsForLocale(entries, 'es');

    expect(result).toEqual([
      { slug: 'acme', locale: 'en', isFallback: true, data: entries[0].data },
    ]);
  });

  it('returns one entry per slug', () => {
    const entries: ProjectEntry[] = [
      { id: 'acme/en', data: project({ title: 'Acme' }) },
      { id: 'beta/en', data: project({ title: 'Beta' }) },
    ];

    const result = selectProjectsForLocale(entries, 'en');

    expect(result.map((entry) => entry.slug).sort()).toEqual(['acme', 'beta']);
  });

  it('returns an empty array for no entries', () => {
    expect(selectProjectsForLocale([], 'en')).toEqual([]);
  });

  it('ignores an entry whose id has no locale segment', () => {
    const entries: ProjectEntry[] = [
      { id: 'no-locale-segment', data: project() },
    ];

    expect(selectProjectsForLocale(entries, 'en')).toEqual([]);
  });
});
