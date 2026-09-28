import { describe, expect, it } from 'vitest';

import { skillsSchema } from './schema';

const validSkill = {
  id: 'typescript',
  name: 'TypeScript',
  category: 'frontend',
};

describe('skillsSchema', () => {
  it('accepts a valid skill', () => {
    expect(() => skillsSchema.parse(validSkill)).not.toThrow();
  });

  it('accepts an optional icon slug', () => {
    expect(() =>
      skillsSchema.parse({ ...validSkill, icon: 'typescript' }),
    ).not.toThrow();
  });

  it('rejects an unknown category', () => {
    expect(() =>
      skillsSchema.parse({ ...validSkill, category: 'design' }),
    ).toThrow();
  });

  it('rejects a missing id', () => {
    const withoutId: Record<string, unknown> = { ...validSkill };
    delete withoutId.id;

    expect(() => skillsSchema.parse(withoutId)).toThrow();
  });
});
