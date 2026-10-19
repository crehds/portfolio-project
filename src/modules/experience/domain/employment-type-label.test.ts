import { describe, expect, it } from 'vitest';

import { getDictionary } from '../../../shared/i18n/ui';
import { employmentTypeLabel } from './employment-type-label';

describe('employmentTypeLabel', () => {
  it('resolves each employment type to its English dictionary label', () => {
    const en = getDictionary('en');

    expect(employmentTypeLabel('full-time', en)).toBe('Full-time');
    expect(employmentTypeLabel('part-time', en)).toBe('Part-time');
    expect(employmentTypeLabel('freelance', en)).toBe('Freelance');
    expect(employmentTypeLabel('contract', en)).toBe('Contract');
  });

  it('resolves each employment type to its Spanish dictionary label', () => {
    const es = getDictionary('es');

    expect(employmentTypeLabel('full-time', es)).toBe('Tiempo completo');
    expect(employmentTypeLabel('part-time', es)).toBe('Medio tiempo');
    expect(employmentTypeLabel('freelance', es)).toBe('Freelance');
    expect(employmentTypeLabel('contract', es)).toBe('Contrato');
  });
});
