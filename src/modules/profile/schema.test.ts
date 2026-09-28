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
