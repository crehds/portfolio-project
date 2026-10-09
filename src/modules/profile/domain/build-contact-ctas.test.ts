import { describe, expect, it } from 'vitest';

import { buildContactCtas } from './build-contact-ctas';

const baseProfile = {
  form: '/contact/',
  whatsapp: '+51970791041',
  email: 'carlos15erh@gmail.com',
  linkedin: 'https://www.linkedin.com/in/carlos-rodriguez-huerta-362ab716a/',
  github: 'https://github.com/crehds',
};

describe('buildContactCtas', () => {
  it('always includes the form, whatsapp, email, linkedin and github, in that order', () => {
    const ctas = buildContactCtas(baseProfile);

    expect(ctas.map((cta) => cta.id)).toEqual([
      'form',
      'whatsapp',
      'email',
      'linkedin',
      'github',
    ]);
  });

  it('points the form cta at the contact page path it is given, whichever locale it is in', () => {
    expect(
      buildContactCtas(baseProfile).find((cta) => cta.id === 'form')?.href,
    ).toBe('/contact/');
    expect(
      buildContactCtas({ ...baseProfile, form: '/es/contact/' }).find(
        (cta) => cta.id === 'form',
      )?.href,
    ).toBe('/es/contact/');
  });

  it('derives the whatsapp href from the E.164 number via wa.me', () => {
    const ctas = buildContactCtas(baseProfile);

    expect(ctas.find((cta) => cta.id === 'whatsapp')?.href).toBe(
      'https://wa.me/51970791041',
    );
  });

  it('builds a mailto href for email', () => {
    const ctas = buildContactCtas(baseProfile);

    expect(ctas.find((cta) => cta.id === 'email')?.href).toBe(
      'mailto:carlos15erh@gmail.com',
    );
  });

  it('passes through the linkedin and github urls unchanged', () => {
    const ctas = buildContactCtas(baseProfile);

    expect(ctas.find((cta) => cta.id === 'linkedin')?.href).toBe(
      baseProfile.linkedin,
    );
    expect(ctas.find((cta) => cta.id === 'github')?.href).toBe(
      baseProfile.github,
    );
  });

  it('omits the cv cta when the profile has no cv set', () => {
    const ctas = buildContactCtas(baseProfile);

    expect(ctas.some((cta) => cta.id === 'cv')).toBe(false);
  });

  it('appends the cv cta last when the profile has a cv set', () => {
    const ctas = buildContactCtas({
      ...baseProfile,
      cv: '/cv/en.pdf',
    });

    expect(ctas.at(-1)).toEqual({ id: 'cv', href: '/cv/en.pdf' });
  });
});
