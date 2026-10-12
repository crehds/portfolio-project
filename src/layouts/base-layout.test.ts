import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it, vi } from 'vitest';

import { localeOfPathname } from '../shared/i18n/paths';
import { getDictionary } from '../shared/i18n/ui';
import type { SocialImage } from '../shared/seo/social-meta';
import { SITE_URL } from '../shared/site/site-url';
import BaseLayout from './BaseLayout.astro';

// The layout reads the profile for its footer from the content layer, which a unit run has
// not synced (and must not depend on having been synced), so the entry is replaced here.
vi.mock('astro:content', () => ({
  getEntry: async () => ({
    data: {
      name: 'Test Name',
      github: 'https://github.com/test',
      linkedin: 'https://www.linkedin.com/in/test/',
      email: 'test@example.com',
    },
  }),
}));

/** What a page hands to the layout (the title and the description have defaults here). */
interface PageProps {
  title?: string;
  description?: string;
  errorPage?: boolean;
  socialImage?: SocialImage;
}

/**
 * Renders the layout for an address. `origin` is where the page is reached (a preview or a
 * local server in practice), which is not the site's own.
 */
async function renderPage(
  pathname: string,
  props: PageProps = {},
  origin = 'http://localhost',
): Promise<string> {
  const container = await AstroContainer.create({
    astroConfig: { site: SITE_URL },
  });

  return container.renderToString(BaseLayout, {
    request: new Request(`${origin}${pathname}`),
    props: { title: 'A title', description: 'A description', ...props },
    slots: { default: '<p>The page</p>' },
  });
}

async function render(
  pathname: string,
  errorPage?: boolean,
  origin?: string,
): Promise<string> {
  return renderPage(pathname, { errorPage }, origin);
}

/** The raw value of an attribute in a string of attributes. */
function attributeOf(attributes: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];
}

/** The `<nav>` with this label (the container also adds source attributes to its tag). */
function navigation(html: string, label: string): string {
  const match = html.match(
    new RegExp(`<nav aria-label="${label}"[^>]*>[\\s\\S]*?</nav>`),
  );
  if (!match) {
    throw new Error(`No navigation labelled "${label}" in the page.`);
  }
  return match[0];
}

/** The links of a navigation: their text, address and `aria-current`. */
function links(nav: string) {
  return [...nav.matchAll(/<a\b([^>]*)>\s*([^<]*?)\s*<\/a>/g)].map(
    ([, attributes, text]) => ({
      text,
      href: attributeOf(attributes, 'href'),
      current: attributeOf(attributes, 'aria-current'),
    }),
  );
}

/** The nav items marked as current, as `text=value`. */
async function currentItems(pathname: string, errorPage?: boolean) {
  const html = await render(pathname, errorPage);
  const { primaryNavLabel } = getDictionary(localeOfPathname(pathname));

  return links(navigation(html, primaryNavLabel))
    .filter((link) => link.current !== undefined)
    .map((link) => `${link.text}=${link.current}`);
}

async function alternates(pathname: string, errorPage?: boolean) {
  const html = await render(pathname, errorPage);

  return [...html.matchAll(/<link rel="alternate"([^>]*)>/g)].map(
    ([, attributes]) => ({
      hreflang: attributeOf(attributes, 'hreflang'),
      href: attributeOf(attributes, 'href'),
    }),
  );
}

/** The `href` of every canonical link in the page. */
async function canonicals(
  pathname: string,
  errorPage?: boolean,
  origin?: string,
) {
  const html = await render(pathname, errorPage, origin);

  return [...html.matchAll(/<link rel="canonical"([^>]*)>/g)].map(
    ([, attributes]) => attributeOf(attributes, 'href'),
  );
}

/** The `content` of every robots meta in the page. */
async function robots(pathname: string, errorPage?: boolean) {
  const html = await render(pathname, errorPage);

  return [...html.matchAll(/<meta name="robots"([^>]*)>/g)].map(
    ([, attributes]) => attributeOf(attributes, 'content'),
  );
}

/**
 * A `<meta>` start tag. The match is quote-aware: Astro leaves `<` and `>` as they are inside
 * a quoted attribute value (it escapes `&` and `"` there), and a title may have either.
 */
const META_TAG = /<meta\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/** The text of an attribute value, as a browser reads it: Astro escapes `"` and `&` in one. */
function decodeAttribute(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

/** Every Open Graph and Twitter tag of the page, as `key=content`, in document order. */
async function socialTags(
  pathname: string,
  props?: PageProps,
  origin?: string,
): Promise<string[]> {
  const html = await renderPage(pathname, props, origin);

  return [...html.matchAll(META_TAG)].flatMap(([, attributes = '']) => {
    const key =
      attributeOf(attributes, 'property') ?? attributeOf(attributes, 'name');

    return key && /^(?:og|twitter):/.test(key)
      ? [`${key}=${decodeAttribute(attributeOf(attributes, 'content') ?? '')}`]
      : [];
  });
}

/** A cover as the project pages hand it over: `getImage` answers with a root-relative address. */
const COVER: SocialImage = {
  src: '/_astro/cover.abc123_Z1x2y3.jpg',
  width: 1200,
  height: 630,
  alt: 'Screenshot of Pysa',
};

async function switcherHrefs(pathname: string, errorPage?: boolean) {
  const html = await render(pathname, errorPage);
  const { languageSwitcherLabel } = getDictionary(localeOfPathname(pathname));

  return links(navigation(html, languageSwitcherLabel)).map(
    (link) => link.href,
  );
}

describe('BaseLayout', () => {
  it('marks the nav item of the page, or of the section a nested page is in', async () => {
    expect(await currentItems('/projects/')).toEqual(['Projects=page']);
    expect(await currentItems('/projects/pysa/')).toEqual(['Projects=true']);
  });

  it('declares the hreflang alternates of the page', async () => {
    expect(await alternates('/projects/pysa/')).toEqual([
      { hreflang: 'en', href: `${SITE_URL}/projects/pysa/` },
      { hreflang: 'es', href: `${SITE_URL}/es/projects/pysa/` },
      { hreflang: 'x-default', href: `${SITE_URL}/projects/pysa/` },
    ]);
  });

  it('links the language switcher to the same page in the other locale', async () => {
    expect(await switcherHrefs('/projects/pysa/')).toEqual([
      '/es/projects/pysa/',
    ]);
  });

  describe('on an indexable page', () => {
    it("declares one canonical link, the page's own hreflang alternate, in both locales", async () => {
      for (const [pathname, locale, expected] of [
        ['/projects/pysa/', 'en', `${SITE_URL}/projects/pysa/`],
        ['/es/projects/pysa/', 'es', `${SITE_URL}/es/projects/pysa/`],
      ] as const) {
        const own = (await alternates(pathname)).find(
          (alternate) => alternate.hreflang === locale,
        );

        expect(await canonicals(pathname), pathname).toEqual([expected]);
        expect(own?.href, pathname).toBe(expected);
      }
    });

    it('adds no alternate link of its own: still the three hreflang alternates', async () => {
      for (const pathname of ['/', '/es/', '/projects/pysa/', '/es/contact/']) {
        expect(await alternates(pathname), pathname).toHaveLength(3);
      }
    });

    it('builds the canonical from the configured site, not from the origin the page is reached on', async () => {
      expect(
        await canonicals('/projects/', false, 'https://preview.example.dev'),
      ).toEqual([`${SITE_URL}/projects/`]);
      expect(await canonicals('/es/', false, 'http://localhost:4331')).toEqual([
        `${SITE_URL}/es/`,
      ]);
    });

    it('slash-terminates the address and leaves the query out', async () => {
      expect(await canonicals('/projects')).toEqual([`${SITE_URL}/projects/`]);
      expect(await canonicals('/contact/?sent=1')).toEqual([
        `${SITE_URL}/contact/`,
      ]);
      expect(await canonicals('/es/contact/?_action=contact')).toEqual([
        `${SITE_URL}/es/contact/`,
      ]);
    });

    it('carries no robots meta', async () => {
      expect(await robots('/projects/pysa/')).toEqual([]);
      expect(await robots('/es/')).toEqual([]);
    });

    it("declares the Open Graph and Twitter tags of the page: the page's own text, the site's name and the locale", async () => {
      const page = {
        title: 'Pysa — Carlos Rodríguez Huerta',
        description: 'A summary of Pysa.',
      };

      for (const [pathname, own, other] of [
        ['/projects/pysa/', 'en_US', 'es_LA'],
        ['/es/projects/pysa/', 'es_LA', 'en_US'],
      ] as const) {
        const { siteTitle } = getDictionary(localeOfPathname(pathname));

        expect(await socialTags(pathname, page), pathname).toEqual([
          'og:type=website',
          `og:site_name=${siteTitle}`,
          'og:title=Pysa — Carlos Rodríguez Huerta',
          'og:description=A summary of Pysa.',
          `og:url=${SITE_URL}${pathname}`,
          `og:locale=${own}`,
          `og:locale:alternate=${other}`,
          'twitter:card=summary',
        ]);
      }
    });

    it('names the canonical address as og:url, however the page was reached', async () => {
      for (const pathname of [
        '/',
        '/projects',
        '/projects/pysa/',
        '/contact/?sent=1',
        '/es/',
        '/es/contact/?_action=contact',
      ]) {
        const [canonical] = await canonicals(pathname);
        const url = (await socialTags(pathname)).filter((tag) =>
          tag.startsWith('og:url='),
        );

        expect(canonical, pathname).toBeDefined();
        expect(url, pathname).toEqual([`og:url=${canonical}`]);
      }
    });

    it('builds og:url from the configured site, not from the origin the page is reached on', async () => {
      expect(
        await socialTags('/projects/', {}, 'https://preview.example.dev'),
      ).toContain(`og:url=${SITE_URL}/projects/`);
      expect(await socialTags('/es/', {}, 'http://localhost:4331')).toContain(
        `og:url=${SITE_URL}/es/`,
      );
    });

    it('writes no picture tag and asks for the small card when the page has no picture', async () => {
      for (const pathname of [
        '/',
        '/projects/pysa/',
        '/es/projects/pysa/',
        '/es/contact/',
      ]) {
        const tags = await socialTags(pathname);

        expect(
          tags.filter((tag) => tag.startsWith('og:image')),
          pathname,
        ).toEqual([]);
        expect(
          tags.filter((tag) => tag.startsWith('twitter:')),
          pathname,
        ).toEqual(['twitter:card=summary']);
      }
    });

    it('puts the picture on the configured site, even when the page is reached on a preview or a local server', async () => {
      for (const [pathname, origin] of [
        ['/projects/pysa/', 'https://preview.example.dev'],
        ['/es/projects/pysa/', 'http://localhost:4331'],
      ] as const) {
        const tags = await socialTags(pathname, { socialImage: COVER }, origin);

        expect(
          tags.filter((tag) => /^(?:og:image|twitter:)/.test(tag)),
          pathname,
        ).toEqual([
          `og:image=${SITE_URL}/_astro/cover.abc123_Z1x2y3.jpg`,
          'og:image:width=1200',
          'og:image:height=630',
          'og:image:alt=Screenshot of Pysa',
          'twitter:card=summary_large_image',
        ]);
      }
    });

    it('leaves a picture that is already at an absolute address where it is', async () => {
      const tags = await socialTags('/projects/pysa/', {
        socialImage: {
          ...COVER,
          src: 'https://cdn.example.com/cards/pysa.jpg',
        },
      });

      expect(tags).toContain('og:image=https://cdn.example.com/cards/pysa.jpg');
    });

    it('adds no alternate link for the picture: still the three hreflang alternates', async () => {
      const html = await renderPage('/projects/pysa/', { socialImage: COVER });

      expect([...html.matchAll(/<link rel="alternate"/g)]).toHaveLength(3);
    });

    it('escapes what it writes into the tags, so a page cannot add tags of its own', async () => {
      const hostile = `x" /><meta property="og:image" content="https://evil.example/x.jpg`;

      const tags = await socialTags('/projects/pysa/', {
        title: 'Fish & "chips" <b>',
        description: hostile,
        socialImage: { ...COVER, alt: 'A "quoted" & <b>bold</b> alt' },
      });

      expect(tags).toContain('og:title=Fish & "chips" <b>');
      expect(tags).toContain(`og:description=${hostile}`);
      expect(tags).toContain('og:image:alt=A "quoted" & <b>bold</b> alt');
      expect(tags.filter((tag) => tag.startsWith('og:image='))).toEqual([
        `og:image=${SITE_URL}/_astro/cover.abc123_Z1x2y3.jpg`,
      ]);
    });
  });

  describe('on an error page', () => {
    it('asks search engines not to index it', async () => {
      // `/404` and `/es/404/` answer 200 as plain assets, so they are reachable as pages.
      expect(await robots('/404', true)).toEqual(['noindex']);
      expect(await robots('/es/404', true)).toEqual(['noindex']);
    });

    it('declares no canonical link', async () => {
      expect(await canonicals('/404', true)).toEqual([]);
      expect(await canonicals('/es/404', true)).toEqual([]);
      expect(await canonicals('/projects/no-such-project/', true)).toEqual([]);
    });

    it('marks no nav item as current, not even the section of the address', async () => {
      // Prerendered, the page is rendered for `/404`; rendered on demand (as `astro dev`
      // does), for the address the visitor asked for, which can be under a real section.
      expect(await currentItems('/404', true)).toEqual([]);
      expect(await currentItems('/projects/no-such-project/', true)).toEqual(
        [],
      );
      expect(await currentItems('/es/skills/no-such-skill/', true)).toEqual([]);
    });

    it('declares no hreflang alternates', async () => {
      expect(await alternates('/404', true)).toEqual([]);
      expect(await alternates('/es/404', true)).toEqual([]);
    });

    it('declares no Open Graph or Twitter tags, even when it is given a picture', async () => {
      // It has no address of its own to share, so a link to it is not previewed as a page.
      for (const pathname of [
        '/404',
        '/es/404',
        '/projects/no-such-project/',
      ]) {
        expect(
          await socialTags(pathname, { errorPage: true }),
          pathname,
        ).toEqual([]);
        expect(
          await socialTags(pathname, { errorPage: true, socialImage: COVER }),
          pathname,
        ).toEqual([]);
      }
    });

    it("links the language switcher to the other locale's home page", async () => {
      expect(await switcherHrefs('/404', true)).toEqual(['/es/']);
      expect(await switcherHrefs('/es/404', true)).toEqual(['/']);
    });
  });
});
