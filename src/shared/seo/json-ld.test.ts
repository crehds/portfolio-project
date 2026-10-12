import { describe, expect, it } from 'vitest';

import { buildPersonJsonLd, serializeJsonLd } from './json-ld';

const PERSON = {
  name: 'Carlos Rodríguez Huerta',
  jobTitle: 'Full-stack web developer',
  description: 'Building front-ends and back-ends.',
  url: 'https://example.com/',
  image: 'https://example.com/_astro/profile-photo.abc123_Z1x2y3.jpg',
  sameAs: ['https://www.linkedin.com/in/test/', 'https://github.com/test'],
};

describe('buildPersonJsonLd', () => {
  it('describes the person with schema.org terms, and nothing more', () => {
    expect(buildPersonJsonLd(PERSON)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Carlos Rodríguez Huerta',
      jobTitle: 'Full-stack web developer',
      description: 'Building front-ends and back-ends.',
      url: 'https://example.com/',
      image: 'https://example.com/_astro/profile-photo.abc123_Z1x2y3.jpg',
      sameAs: ['https://www.linkedin.com/in/test/', 'https://github.com/test'],
    });
  });

  it('keeps the profiles in the order given, and copies them', () => {
    const result = buildPersonJsonLd(PERSON);

    expect(result.sameAs).toEqual(PERSON.sameAs);
    expect(result.sameAs).not.toBe(PERSON.sameAs);
  });

  it.each(['url', 'image'] as const)(
    'refuses a %s that is not absolute: a crawler cannot resolve it',
    (field) => {
      expect(() =>
        buildPersonJsonLd({ ...PERSON, [field]: '/relative/path' }),
      ).toThrow(`The ${field} of the person must be absolute`);
    },
  );

  it('refuses a profile address that is not absolute', () => {
    expect(() =>
      buildPersonJsonLd({ ...PERSON, sameAs: ['github.com/test'] }),
    ).toThrow('The sameAs of the person must be absolute');
  });
});

describe('serializeJsonLd', () => {
  it('writes JSON that parses back to the same value', () => {
    const value = buildPersonJsonLd(PERSON);

    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });

  it('escapes every "<", so the content cannot close or open a tag', () => {
    const value = buildPersonJsonLd({
      ...PERSON,
      description: 'Ends the script </script><script>alert(1)</script> <!--',
    });

    const text = serializeJsonLd(value);

    expect(text).not.toContain('<');
    expect(text).toContain('\\u003c/script>');
    expect(JSON.parse(text)).toEqual(value);
  });

  it('leaves accented text as it is', () => {
    expect(serializeJsonLd({ name: 'Rodríguez' })).toBe('{"name":"Rodríguez"}');
  });
});
