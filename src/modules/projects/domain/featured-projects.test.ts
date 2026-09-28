import { describe, expect, it } from 'vitest';

import { featuredProjects } from './featured-projects';

function project(
  overrides: Partial<{
    featured: boolean;
    status: 'draft' | 'published';
    date: Date;
  }> = {},
) {
  return {
    data: {
      featured: false,
      status: 'published' as const,
      date: new Date('2026-01-01'),
      ...overrides,
    },
  };
}

describe('featuredProjects', () => {
  it('excludes drafts by default', () => {
    const draft = project({ status: 'draft' });
    const published = project({ status: 'published' });

    const result = featuredProjects([draft, published]);

    expect(result).toEqual([published]);
  });

  it('includes drafts when includeDrafts is true', () => {
    const draft = project({ status: 'draft' });

    const result = featuredProjects([draft], { includeDrafts: true });

    expect(result).toEqual([draft]);
  });

  it('sorts featured projects before non-featured ones', () => {
    const notFeatured = project({
      featured: false,
      date: new Date('2026-06-01'),
    });
    const featured = project({ featured: true, date: new Date('2026-01-01') });

    const result = featuredProjects([notFeatured, featured]);

    expect(result).toEqual([featured, notFeatured]);
  });

  it('within the same featured status, sorts by date descending', () => {
    const older = project({ date: new Date('2025-01-01') });
    const newer = project({ date: new Date('2026-01-01') });

    const result = featuredProjects([older, newer]);

    expect(result).toEqual([newer, older]);
  });

  it('applies a limit after sorting', () => {
    const a = project({ date: new Date('2026-03-01') });
    const b = project({ date: new Date('2026-02-01') });
    const c = project({ date: new Date('2026-01-01') });

    const result = featuredProjects([a, b, c], { limit: 2 });

    expect(result).toEqual([a, b]);
  });

  it('returns an empty array for no entries', () => {
    expect(featuredProjects([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const a = project({ date: new Date('2026-01-01') });
    const b = project({ date: new Date('2026-02-01') });
    const entries = [a, b];
    const copy = [...entries];

    featuredProjects(entries);

    expect(entries).toEqual(copy);
  });
});
