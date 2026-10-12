import { describe, expect, it } from 'vitest';

import { homeMetadata } from './home-metadata';

// The profile's fields as `src/content/profile.yaml` has them, spelled out so that this test
// pins the exact strings the home pages get (e2e/seo.spec.ts pins them in the built site).
const profile = {
  name: 'Carlos Rodríguez Huerta',
  role: {
    en: 'Full-stack web developer',
    es: 'Desarrollador web full-stack',
  },
  headline: {
    en: 'Building JavaScript/TypeScript front-ends and Ruby on Rails and Node.js back-ends.',
    es: 'Creo interfaces en JavaScript/TypeScript y back-ends en Ruby on Rails y Node.js.',
  },
};

describe('homeMetadata', () => {
  it('titles the page with the name, an em dash and the role', () => {
    expect(homeMetadata(profile, 'en').title).toBe(
      'Carlos Rodríguez Huerta — Full-stack web developer',
    );
    expect(homeMetadata(profile, 'es').title).toBe(
      'Carlos Rodríguez Huerta — Desarrollador web full-stack',
    );
  });

  it('describes the page with the role, a full stop and the headline', () => {
    expect(homeMetadata(profile, 'en').description).toBe(
      'Full-stack web developer. Building JavaScript/TypeScript front-ends and Ruby on Rails and Node.js back-ends.',
    );
    expect(homeMetadata(profile, 'es').description).toBe(
      'Desarrollador web full-stack. Creo interfaces en JavaScript/TypeScript y back-ends en Ruby on Rails y Node.js.',
    );
  });

  it('describes the page with the role alone when the profile has no headline', () => {
    const withoutHeadline = { name: profile.name, role: profile.role };

    expect(homeMetadata(withoutHeadline, 'en').description).toBe(
      'Full-stack web developer.',
    );
    expect(homeMetadata(withoutHeadline, 'es').description).toBe(
      'Desarrollador web full-stack.',
    );
  });

  it('takes every word from the profile, in the language asked for', () => {
    const other = {
      name: 'Ada Lovelace',
      role: { en: 'Analyst', es: 'Analista' },
      headline: { en: 'Notes on engines.', es: 'Notas sobre máquinas.' },
    };

    expect(homeMetadata(other, 'es')).toEqual({
      title: 'Ada Lovelace — Analista',
      description: 'Analista. Notas sobre máquinas.',
    });
  });
});
