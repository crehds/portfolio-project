import { describe, expect, it } from 'vitest';

import { groupSkillsByCategory } from './group-by-category';

describe('groupSkillsByCategory', () => {
  it('groups skills under their category', () => {
    const react = { id: 'react', name: 'React', category: 'frontend' as const };
    const node = { id: 'node', name: 'Node.js', category: 'backend' as const };

    const result = groupSkillsByCategory([react, node]);

    expect(result).toEqual([
      { category: 'frontend', skills: [react] },
      { category: 'backend', skills: [node] },
    ]);
  });

  it('uses a stable category order regardless of input order', () => {
    const testing = {
      id: 'vitest',
      name: 'Vitest',
      category: 'testing' as const,
    };
    const frontend = {
      id: 'astro',
      name: 'Astro',
      category: 'frontend' as const,
    };

    const result = groupSkillsByCategory([testing, frontend]);

    expect(result.map((group) => group.category)).toEqual([
      'frontend',
      'testing',
    ]);
  });

  it('omits categories with no skills', () => {
    const frontend = {
      id: 'astro',
      name: 'Astro',
      category: 'frontend' as const,
    };

    const result = groupSkillsByCategory([frontend]);

    expect(result).toEqual([{ category: 'frontend', skills: [frontend] }]);
  });

  it('keeps multiple skills in the same category together, in input order', () => {
    const ts = {
      id: 'typescript',
      name: 'TypeScript',
      category: 'frontend' as const,
    };
    const astro = { id: 'astro', name: 'Astro', category: 'frontend' as const };

    const result = groupSkillsByCategory([ts, astro]);

    expect(result).toEqual([{ category: 'frontend', skills: [ts, astro] }]);
  });

  it('returns an empty array for no skills', () => {
    expect(groupSkillsByCategory([])).toEqual([]);
  });
});
