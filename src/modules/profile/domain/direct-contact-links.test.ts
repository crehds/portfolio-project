import { describe, expect, it } from 'vitest';

import { directContactLinks } from './direct-contact-links';

const profile = {
  whatsapp: '+51970791041',
  email: 'carlos15erh@gmail.com',
};

describe('directContactLinks', () => {
  it('lists whatsapp, then email, and nothing else', () => {
    expect(directContactLinks(profile).map((link) => link.id)).toEqual([
      'whatsapp',
      'email',
    ]);
  });

  it('derives the whatsapp href from the E.164 number via wa.me', () => {
    const whatsapp = directContactLinks(profile).find(
      (link) => link.id === 'whatsapp',
    );

    expect(whatsapp?.href).toBe('https://wa.me/51970791041');
  });

  it('builds a mailto href for the email', () => {
    const email = directContactLinks(profile).find(
      (link) => link.id === 'email',
    );

    expect(email?.href).toBe('mailto:carlos15erh@gmail.com');
  });

  it('carries an id and an href per link and no other field', () => {
    for (const link of directContactLinks(profile)) {
      expect(Object.keys(link).sort()).toEqual(['href', 'id']);
    }
  });
});
