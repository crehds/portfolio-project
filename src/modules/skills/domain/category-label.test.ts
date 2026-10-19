import { describe, expect, it } from 'vitest';

import { getDictionary } from '../../../shared/i18n/ui';
import { skillCategoryLabel } from './category-label';

describe('skillCategoryLabel', () => {
  it('resolves each category to its English dictionary label', () => {
    const en = getDictionary('en');

    expect(skillCategoryLabel('frontend', en)).toBe('Frontend');
    expect(skillCategoryLabel('backend', en)).toBe('Backend');
    expect(skillCategoryLabel('data', en)).toBe('Data');
    expect(skillCategoryLabel('devops', en)).toBe('DevOps');
    expect(skillCategoryLabel('testing', en)).toBe('Testing');
    expect(skillCategoryLabel('tools', en)).toBe('Tools');
  });

  it('resolves each category to its Spanish dictionary label', () => {
    const es = getDictionary('es');

    expect(skillCategoryLabel('frontend', es)).toBe('Frontend');
    expect(skillCategoryLabel('backend', es)).toBe('Backend');
    expect(skillCategoryLabel('data', es)).toBe('Datos');
    expect(skillCategoryLabel('devops', es)).toBe('DevOps');
    expect(skillCategoryLabel('testing', es)).toBe('Testing');
    expect(skillCategoryLabel('tools', es)).toBe('Herramientas');
  });
});
