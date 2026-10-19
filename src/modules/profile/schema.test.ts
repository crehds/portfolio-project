import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';

import { profileSchema } from './schema';

// Schema contract tests don't need Astro's real image pipeline: fields that use
// `image()` are optional here and omitted from the fixtures below, so a minimal
// stand-in cast to the real `SchemaContext['image']` type is enough.
const stubImage = (() =>
  z.object({
    src: z.string(),
    width: z.number(),
    height: z.number(),
    format: z.string(),
  })) as unknown as SchemaContext['image'];

const schema = profileSchema({ image: stubImage });

const validProfile = {
  name: 'Carlos Rodríguez Huerta',
  role: { en: 'Full-stack web developer', es: 'Desarrollador web full-stack' },
  email: 'carlos15erh@gmail.com',
  whatsapp: '+51970791041',
  linkedin: 'https://www.linkedin.com/in/carlos-rodriguez-huerta-362ab716a/',
  github: 'https://github.com/crehds',
};

describe('profileSchema', () => {
  it('accepts a valid profile', () => {
    expect(() => schema.parse(validProfile)).not.toThrow();
  });

  it('rejects an invalid email', () => {
    expect(() =>
      schema.parse({ ...validProfile, email: 'not-an-email' }),
    ).toThrow();
  });

  it('rejects a whatsapp number that is not E.164', () => {
    expect(() =>
      schema.parse({ ...validProfile, whatsapp: '970791041' }),
    ).toThrow();
  });

  it('rejects an invalid linkedin url', () => {
    expect(() =>
      schema.parse({ ...validProfile, linkedin: 'not-a-url' }),
    ).toThrow();
  });

  it('rejects an invalid github url', () => {
    expect(() =>
      schema.parse({ ...validProfile, github: 'not-a-url' }),
    ).toThrow();
  });

  it('requires every locale on a localized field', () => {
    expect(() =>
      schema.parse({ ...validProfile, role: { en: 'Only English' } }),
    ).toThrow();
  });
});

describe('profileSchema cv', () => {
  it('accepts a cv that points each locale at its own download route', () => {
    const profile = schema.parse({
      ...validProfile,
      cv: { en: '/cv/en.pdf', es: '/cv/es.pdf' },
    });

    expect(profile.cv).toEqual({ en: '/cv/en.pdf', es: '/cv/es.pdf' });
  });

  it('keeps the cv optional', () => {
    expect(schema.parse(validProfile).cv).toBeUndefined();
  });

  it.each([
    ['the other locale download route', { en: '/cv/es.pdf', es: '/cv/es.pdf' }],
    ['an external url', { en: 'https://example.com/cv.pdf', es: '/cv/es.pdf' }],
    ['a path outside the download route', { en: '/cv/en.pdf', es: '/cv.pdf' }],
    ['a missing leading slash', { en: 'cv/en.pdf', es: '/cv/es.pdf' }],
    ['an empty path', { en: '/cv/en.pdf', es: '' }],
    ['a missing locale', { en: '/cv/en.pdf' }],
  ])('rejects %s', (_label, cv) => {
    expect(() => schema.parse({ ...validProfile, cv })).toThrow();
  });

  it('names the offending locale and the path it must have', () => {
    const result = schema.safeParse({
      ...validProfile,
      cv: { en: '/cv/es.pdf', es: '/cv/es.pdf' },
    });

    if (result.success) {
      throw new Error('Expected the schema to reject the cv.');
    }
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0].path).toEqual(['cv', 'en']);
    expect(result.error.issues[0].message).toContain('/cv/en.pdf');
  });
});
