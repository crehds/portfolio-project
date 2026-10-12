import { describe, expect, it } from 'vitest';

import { LOCALES } from '../i18n/locales';
import { OPEN_GRAPH_LOCALES, buildSocialMeta } from './social-meta';

const PAGE = {
  siteName: 'Carlos Rodríguez Huerta',
  title: 'Pysa — Carlos Rodríguez Huerta',
  description: 'A summary of Pysa.',
  url: 'https://example.com/projects/pysa/',
};

const IMAGE = {
  src: 'https://example.com/_astro/cover.abc123_Z1x2y3.jpg',
  width: 1200,
  height: 630,
  alt: 'Screenshot of Pysa',
};

describe('buildSocialMeta', () => {
  it('describes an English page without a picture, in the order a preview reads it', () => {
    expect(buildSocialMeta({ ...PAGE, locale: 'en' })).toEqual([
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Carlos Rodríguez Huerta' },
      { property: 'og:title', content: 'Pysa — Carlos Rodríguez Huerta' },
      { property: 'og:description', content: 'A summary of Pysa.' },
      { property: 'og:url', content: 'https://example.com/projects/pysa/' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:locale:alternate', content: 'es_LA' },
      { name: 'twitter:card', content: 'summary' },
    ]);
  });

  it('describes a Spanish page without a picture: its own locale first, the other as the alternate', () => {
    expect(
      buildSocialMeta({
        ...PAGE,
        locale: 'es',
        url: 'https://example.com/es/projects/pysa/',
      }),
    ).toEqual([
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Carlos Rodríguez Huerta' },
      { property: 'og:title', content: 'Pysa — Carlos Rodríguez Huerta' },
      { property: 'og:description', content: 'A summary of Pysa.' },
      { property: 'og:url', content: 'https://example.com/es/projects/pysa/' },
      { property: 'og:locale', content: 'es_LA' },
      { property: 'og:locale:alternate', content: 'en_US' },
      { name: 'twitter:card', content: 'summary' },
    ]);
  });

  it('adds the picture, with its size and its alt text, and asks for the large card', () => {
    expect(buildSocialMeta({ ...PAGE, locale: 'en', image: IMAGE })).toEqual([
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Carlos Rodríguez Huerta' },
      { property: 'og:title', content: 'Pysa — Carlos Rodríguez Huerta' },
      { property: 'og:description', content: 'A summary of Pysa.' },
      { property: 'og:url', content: 'https://example.com/projects/pysa/' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:locale:alternate', content: 'es_LA' },
      {
        property: 'og:image',
        content: 'https://example.com/_astro/cover.abc123_Z1x2y3.jpg',
      },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'Screenshot of Pysa' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ]);
  });

  it('chooses the card by the picture alone, in every locale', () => {
    for (const locale of LOCALES) {
      const without = buildSocialMeta({ ...PAGE, locale });
      const withPicture = buildSocialMeta({ ...PAGE, locale, image: IMAGE });
      const cardOf = (tags: ReturnType<typeof buildSocialMeta>) =>
        tags.filter((tag) => 'name' in tag && tag.name === 'twitter:card');

      expect(cardOf(without), locale).toEqual([
        { name: 'twitter:card', content: 'summary' },
      ]);
      expect(cardOf(withPicture), locale).toEqual([
        { name: 'twitter:card', content: 'summary_large_image' },
      ]);
    }
  });

  it('leaves out every picture tag when there is no picture', () => {
    for (const locale of LOCALES) {
      const keys = buildSocialMeta({ ...PAGE, locale }).map((tag) =>
        'property' in tag ? tag.property : tag.name,
      );

      expect(
        keys.filter((key) => key.startsWith('og:image')),
        locale,
      ).toEqual([]);
    }
  });

  it('names one alternate locale for each of the other locales, and none for its own', () => {
    for (const locale of LOCALES) {
      const tags = buildSocialMeta({ ...PAGE, locale });
      const contentsOf = (property: string) =>
        tags.flatMap((tag) =>
          'property' in tag && tag.property === property ? [tag.content] : [],
        );

      expect(contentsOf('og:locale'), locale).toEqual([
        OPEN_GRAPH_LOCALES[locale],
      ]);
      expect(contentsOf('og:locale:alternate'), locale).toEqual(
        LOCALES.filter((other) => other !== locale).map(
          (other) => OPEN_GRAPH_LOCALES[other],
        ),
      );
    }
  });

  it('names no X account: the profile has none to name', () => {
    for (const locale of LOCALES) {
      for (const image of [undefined, IMAGE]) {
        const names = buildSocialMeta({ ...PAGE, locale, image })
          .flatMap((tag) => ('name' in tag ? [tag.name] : []))
          .sort();

        expect(names, locale).toEqual(['twitter:card']);
      }
    }
  });

  it("keeps the text as it is: escaping it is the markup's job, and doing it twice would show", () => {
    const tags = buildSocialMeta({
      ...PAGE,
      locale: 'en',
      title: 'Fish & "chips" <b>',
      description: `It's "fine" & <i>quick</i>`,
      image: { ...IMAGE, alt: 'A "quoted" & <b>bold</b> alt' },
    });
    const contentOf = (property: string) =>
      tags.find((tag) => 'property' in tag && tag.property === property)
        ?.content;

    expect(contentOf('og:title')).toBe('Fish & "chips" <b>');
    expect(contentOf('og:description')).toBe(`It's "fine" & <i>quick</i>`);
    expect(contentOf('og:image:alt')).toBe('A "quoted" & <b>bold</b> alt');
  });

  it('refuses a picture whose address is not absolute: a preview could not fetch it', () => {
    // The layout makes the address absolute with the configured site; a caller that skips
    // that gets the build to fail, not a preview without a picture.
    for (const src of [
      '/_astro/cover.abc123_Z1x2y3.jpg',
      '_astro/cover.abc123_Z1x2y3.jpg',
      '//example.com/_astro/cover.abc123_Z1x2y3.jpg',
      '',
    ]) {
      expect(
        () =>
          buildSocialMeta({
            ...PAGE,
            locale: 'en',
            image: { ...IMAGE, src },
          }),
        src,
      ).toThrow(
        `The social image must have an absolute address, and "${src}" is not one.`,
      );
    }
  });
});

describe('OPEN_GRAPH_LOCALES', () => {
  it("is Facebook's code for each locale: es_LA for the Latin American Spanish the site uses", () => {
    // `es_LA` is Open Graph's name for Latin American Spanish, which `es-419` (the tag of every
    // date formatter, see `INTL_LOCALE_TAGS`) stands for. It is not the Spanish of Spain, `es_ES`.
    expect(OPEN_GRAPH_LOCALES).toEqual({ en: 'en_US', es: 'es_LA' });
  });

  it('has a distinct language_TERRITORY code for every locale of the site', () => {
    const codes = LOCALES.map((locale) => OPEN_GRAPH_LOCALES[locale]);

    for (const code of codes) {
      expect(code).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    }
    expect(new Set(codes).size).toBe(LOCALES.length);
    expect(Object.keys(OPEN_GRAPH_LOCALES).sort()).toEqual([...LOCALES].sort());
  });
});
