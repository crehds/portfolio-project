import { readdirSync } from 'node:fs';
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

import { SITE_URL } from '../src/shared/site/site-url';
import { COPY } from './support/contact-copy';

// What a search engine is told about every address of the site (T12): which URL is the page's
// own, which pages stay out of the index, and what the two files crawlers read first, robots.txt
// and the sitemap, say about them. The unit tests (paths.test.ts, base-layout.test.ts,
// robots-txt.test.ts, sitemap-alternates.test.ts) prove the rules; this spec proves them in the
// built site, page by page, in both locales.
//
// The test server answers on localhost, and the canonical link names the production host: the
// link is built from the configured site, never from the address the page was reached on. The
// same goes for the sitemap, whose addresses are all production ones.

type Lang = 'en' | 'es';

/** An address in a locale: English is unprefixed, Spanish lives under `/es/`. */
function inLang(lang: Lang, path: string): string {
  return lang === 'en' ? path : `/es${path}`;
}

const LANGS: readonly Lang[] = ['en', 'es'];

// The published projects, as in projects-list.spec.ts. The drafts have no page.
const PUBLISHED_PROJECT_SLUGS = [
  'expresion-latina',
  'pysa',
  'game-with-keyboard',
  'bachatealo',
];

// One page per published project, in each locale. They are the pages with a cover, which a link
// preview shows as the page's picture.
const PROJECT_PAGES = LANGS.flatMap((lang) =>
  PUBLISHED_PROJECT_SLUGS.map((slug) => ({
    lang,
    path: inLang(lang, `/projects/${slug}/`),
  })),
);

// Home, the three section pages and the project pages, in each locale: the pages that are static
// files in the build. The contact pages run on demand (the form posts to them), so the build has
// no file for them; COPY has their addresses.
const PRERENDERED = [
  ...LANGS.flatMap((lang) =>
    ['/', '/projects/', '/experience/', '/skills/'].map((path) => ({
      lang,
      path: inLang(lang, path),
    })),
  ),
  ...PROJECT_PAGES,
];

const ON_DEMAND = COPY.map(({ lang, path }) => ({ lang, path }));

const PAGES = [...PRERENDERED, ...ON_DEMAND];

// The 404 pages are built like any other page but are not indexable (see below). `404.html` is
// not a folder index, so only the Spanish one needs to be named.
const BUILT_ERROR_PAGES = ['/es/404/'];

const DIST_CLIENT = new URL('../dist/client/', import.meta.url);

/** The address of every folder index in the build, but the error pages', sorted. */
function prerenderedPathsInBuild(): string[] {
  return readdirSync(DIST_CLIENT, { recursive: true, encoding: 'utf8' })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => file === 'index.html' || file.endsWith('/index.html'))
    .map((file) => `/${file.slice(0, -'index.html'.length)}`)
    .filter((path) => !BUILT_ERROR_PAGES.includes(path))
    .sort();
}

test.describe('the pages this spec checks', () => {
  // The checks below are table-driven, so a page that is missing from the table is a page that
  // is not checked. Reading the build is what keeps the table honest: a page added to or removed
  // from the site, or dropped from the table by mistake, fails here instead of going unseen.
  test('are every indexable page of the site, in both locales', () => {
    expect(prerenderedPathsInBuild()).toEqual(
      PRERENDERED.map(({ path }) => path).sort(),
    );
    // 16 static pages and the 2 contact pages.
    expect(PAGES).toHaveLength(18);
  });
});

test.describe('canonical link', () => {
  for (const { lang, path } of PAGES) {
    test(`${path} has one, its own address on the site, and no robots meta`, async ({
      page,
    }) => {
      await page.goto(path);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      await expect(canonical).toHaveAttribute('href', `${SITE_URL}${path}`);
      // It names the page's own hreflang alternate, so the two never disagree.
      await expect(
        page.locator(`link[rel="alternate"][hreflang="${lang}"]`),
      ).toHaveAttribute('href', `${SITE_URL}${path}`);
      // An indexable page must not ask to be left out.
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    });
  }

  for (const { lang, path, sentPath } of COPY) {
    test(`${sentPath} leaves the query out (${lang})`, async ({ page }) => {
      const response = await page.goto(sentPath);

      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).search).toBe('?sent=1');
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      await expect(canonical).toHaveAttribute('href', `${SITE_URL}${path}`);
    });
  }
});

// The home page says who the owner is and what they do, from the profile (src/content/profile.yaml)
// and nothing else: the name and the role in the title, the role and the headline in the
// description. Spelled out here, not imported, so that a change to the wording is a change to the
// tests too (src/modules/profile/domain/home-metadata.test.ts pins the rule on its own).
test.describe('home page title and description', () => {
  for (const { lang, path, title, description } of [
    {
      lang: 'en',
      path: '/',
      title: 'Carlos Rodríguez Huerta — Full-stack web developer',
      description:
        'Full-stack web developer. Building JavaScript/TypeScript front-ends and Ruby on Rails and Node.js back-ends.',
    },
    {
      lang: 'es',
      path: '/es/',
      title: 'Carlos Rodríguez Huerta — Desarrollador web full-stack',
      description:
        'Desarrollador web full-stack. Creo interfaces en JavaScript/TypeScript y back-ends en Ruby on Rails y Node.js.',
    },
  ] as const) {
    test(`are made of the profile (${lang})`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveTitle(title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        description,
      );
    });
  }
});

// What a link preview is made of: the Open Graph tags that LinkedIn, Slack and Facebook read, and
// the card type that X reads (it falls back to the Open Graph tags for the rest). Like the other
// expectations of this file, they are spelled out here and not imported from
// src/shared/seo/social-meta.ts, so that a change to the rule is a change to the tests too.
const SOCIAL_SITE_NAME = 'Carlos Rodríguez Huerta';

// The tags of a page, whatever it shows.
const SOCIAL_KEYS = [
  'og:type',
  'og:site_name',
  'og:title',
  'og:description',
  'og:url',
  'og:locale',
  'og:locale:alternate',
  'twitter:card',
];

// Every page shares a picture, which has four more: the picture, its size, its type and its alt
// text. It is the project's cover or, for any other page, the default card of the locale.
const SOCIAL_IMAGE_KEYS = [
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:type',
  'og:image:alt',
];

/** Every Open Graph and Twitter tag of the page, as `[key, content]`, in document order. */
async function socialTags(page: Page): Promise<[string, string][]> {
  return page
    .locator('meta[property^="og:"], meta[name^="twitter:"]')
    .evaluateAll((tags) =>
      tags.map((tag): [string, string] => [
        tag.getAttribute('property') ?? tag.getAttribute('name') ?? '',
        tag.getAttribute('content') ?? '',
      ]),
    );
}

/** The contents of the tags with this key. */
function valuesOf(tags: [string, string][], key: string): string[] {
  return tags.filter(([name]) => name === key).map(([, content]) => content);
}

test.describe('Open Graph and Twitter tags', () => {
  for (const { lang, path } of PAGES) {
    test(`${path} describes itself to a link preview`, async ({ page }) => {
      await page.goto(path);

      const tags = await socialTags(page);
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute('href');

      // Nothing else, and nothing twice. In particular no `twitter:site` or `twitter:creator`:
      // the profile has no X handle to name.
      expect(tags.map(([key]) => key).sort()).toEqual(
        [...SOCIAL_KEYS, ...SOCIAL_IMAGE_KEYS].sort(),
      );
      expect(valuesOf(tags, 'og:type')).toEqual(['website']);
      expect(valuesOf(tags, 'og:site_name')).toEqual([SOCIAL_SITE_NAME]);
      // The title and the description are the page's own.
      expect(valuesOf(tags, 'og:title')).toEqual([await page.title()]);
      expect(description).toBeTruthy();
      expect(valuesOf(tags, 'og:description')).toEqual([description]);
      // The address is the canonical one, so a preview of a shared link counts for the page.
      expect(valuesOf(tags, 'og:url')).toEqual([`${SITE_URL}${path}`]);
      expect(valuesOf(tags, 'og:url')).toEqual([canonical]);
      // Facebook's code for Latin American Spanish is `es_LA`, and the page names the other
      // locale as the alternate.
      expect(valuesOf(tags, 'og:locale')).toEqual([
        lang === 'en' ? 'en_US' : 'es_LA',
      ]);
      expect(valuesOf(tags, 'og:locale:alternate')).toEqual([
        lang === 'en' ? 'es_LA' : 'en_US',
      ]);
      // Every page has a picture to show, so every page asks for the large card.
      expect(valuesOf(tags, 'twitter:card')).toEqual(['summary_large_image']);
    });
  }
});

// The cover is the picture that opens the project's article, as a direct child of it. A picture
// inside the case study's text (the body is Markdown) is deeper in the article, so it is not
// taken for the cover, and the test does not break when one is added.
const PROJECT_COVER = 'main article > picture > img';

// A project page shares its cover. The file is cropped when the site is built, so it is checked
// for what it is: a JPEG of exactly the size a preview takes, which the site serves itself.
test.describe('the picture of a project page', () => {
  for (const { path } of PROJECT_PAGES) {
    test(`${path} shares its cover, cropped to 1200x630`, async ({
      page,
      request,
    }) => {
      await page.goto(path);

      const tags = await socialTags(page);
      const cover = page.locator(PROJECT_COVER);
      await expect(cover).toHaveCount(1);
      const alt = await cover.getAttribute('alt');

      // An absolute address on the site, whatever host the test reached the page on.
      const images = valuesOf(tags, 'og:image');
      expect(images).toHaveLength(1);
      const url = new URL(images[0] ?? '');
      expect(url.origin).toBe(SITE_URL);
      // Astro names the file after the format it was asked for (`jpeg`); what the file is
      // gets checked below.
      expect(url.pathname).toMatch(/^\/_astro\/[^/]+\.jpe?g$/);

      // The browser here resolves no host but the local ones, so the file is fetched from the
      // test server, which has it at the same pathname.
      const response = await request.get(url.pathname);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toMatch(/^image\/jpeg\b/);
      const bytes = await response.body();
      expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);

      // The browser decodes it, so the size is the picture's own and not what a header claims.
      const decoded = await page.evaluate(async (src) => {
        const picture = new Image();
        picture.src = src;
        await picture.decode();
        return { width: picture.naturalWidth, height: picture.naturalHeight };
      }, url.pathname);
      expect(decoded).toEqual({ width: 1200, height: 630 });

      // The tags say what the file is, and describe it the way the page describes its cover.
      expect(valuesOf(tags, 'og:image:width')).toEqual(['1200']);
      expect(valuesOf(tags, 'og:image:height')).toEqual(['630']);
      expect(valuesOf(tags, 'og:image:type')).toEqual(['image/jpeg']);
      expect(alt).toBeTruthy();
      expect(valuesOf(tags, 'og:image:alt')).toEqual([alt]);
    });
  }

  for (const { path, alt } of [
    { path: '/projects/pysa/', alt: 'Screenshot of Pysa' },
    { path: '/es/projects/pysa/', alt: 'Captura de pantalla de Pysa Gaming' },
  ]) {
    test(`${path} describes its picture as "${alt}"`, async ({ page }) => {
      await page.goto(path);

      expect(valuesOf(await socialTags(page), 'og:image:alt')).toEqual([alt]);
    });
  }
});

// Every other page shares the default card of its locale: a static 1200x630 PNG (src/assets/og)
// with the owner's name and role. Its size and type are the file's own, so they are read from
// the file the test server sends, not from what the tags say, and the tags are checked against it.
const DEFAULT_CARD_ALT = {
  en: 'Carlos Rodríguez Huerta — Full-stack web developer',
  es: 'Carlos Rodríguez Huerta — Desarrollador web full-stack',
} as const;

const PAGES_WITHOUT_COVER = PAGES.filter(
  ({ path }) => !PROJECT_PAGES.some((project) => project.path === path),
);

/** The width and height that a PNG file declares in its IHDR chunk. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect([...bytes.subarray(0, 8)]).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test.describe('the default card of a page without a cover', () => {
  test('are the home, the list, the section and the contact pages, in both locales', () => {
    expect(PAGES_WITHOUT_COVER.map(({ path }) => path).sort()).toEqual(
      LANGS.flatMap((lang) =>
        ['/', '/projects/', '/experience/', '/skills/', '/contact/'].map(
          (path) => inLang(lang, path),
        ),
      ).sort(),
    );
  });

  for (const { lang, path } of PAGES_WITHOUT_COVER) {
    test(`${path} shares the card of its locale, 1200x630`, async ({
      page,
      request,
    }) => {
      await page.goto(path);

      const tags = await socialTags(page);
      // An absolute address on the site, whatever host the test reached the page on.
      const images = valuesOf(tags, 'og:image');
      expect(images).toHaveLength(1);
      const url = new URL(images[0] ?? '');
      expect(url.origin).toBe(SITE_URL);
      expect(url.pathname).toMatch(
        new RegExp(`^/_astro/og-card-${lang}\.[^/]+\.png$`),
      );

      // The test server has the file at the same pathname, as an image.
      const response = await request.get(url.pathname);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toMatch(/^image\/png\b/);
      const size = pngSize(await response.body());
      expect(size).toEqual({ width: 1200, height: 630 });

      // The tags declare what the file is.
      expect(valuesOf(tags, 'og:image:width')).toEqual([String(size.width)]);
      expect(valuesOf(tags, 'og:image:height')).toEqual([String(size.height)]);
      expect(valuesOf(tags, 'og:image:type')).toEqual(['image/png']);
      expect(valuesOf(tags, 'og:image:alt')).toEqual([DEFAULT_CARD_ALT[lang]]);
    });
  }

  test('a project page keeps its cover instead', async ({ page }) => {
    await page.goto('/projects/pysa/');

    const images = valuesOf(await socialTags(page), 'og:image');
    expect(images).toHaveLength(1);
    expect(images[0]).not.toContain('og-card');
  });
});

// What a crawler is told about the owner: a schema.org `Person` on the two home pages, made of the
// profile (src/content/profile.yaml) and nothing else. Spelled out here, not imported, like the
// other expectations of this file.
const JSON_LD_SCRIPT = 'script[type="application/ld+json"]';

const HOME_PERSONS = [
  {
    path: '/',
    jobTitle: 'Full-stack web developer',
    description:
      'Building JavaScript/TypeScript front-ends and Ruby on Rails and Node.js back-ends.',
  },
  {
    path: '/es/',
    jobTitle: 'Desarrollador web full-stack',
    description:
      'Creo interfaces en JavaScript/TypeScript y back-ends en Ruby on Rails y Node.js.',
  },
] as const;

test.describe('structured data', () => {
  for (const { path, jobTitle, description } of HOME_PERSONS) {
    test(`${path} has exactly one valid Person, made of the profile`, async ({
      page,
      request,
    }) => {
      await page.goto(path);

      const scripts = page.locator(JSON_LD_SCRIPT);
      await expect(scripts).toHaveCount(1);
      const person = JSON.parse((await scripts.textContent()) ?? '');

      // The photo is an address on the site, whatever host the test reached the page on.
      const image = new URL(person.image);
      expect(image.origin).toBe(SITE_URL);
      expect(image.pathname).toMatch(/^\/_astro\/[^/]+\.jpe?g$/);

      expect(person).toEqual({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Carlos Rodríguez Huerta',
        jobTitle,
        description,
        url: `${SITE_URL}${path}`,
        image: person.image,
        sameAs: [
          'https://www.linkedin.com/in/carlos-rodriguez-huerta-362ab716a/',
          'https://github.com/crehds',
        ],
      });
      // Its URL is the page's canonical one.
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        person.url,
      );

      // The photo is a real file of the site, served by the test server at the same pathname.
      const response = await request.get(image.pathname);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toMatch(/^image\/jpeg\b/);
    });

    test(`${path} writes no "<" inside the script`, async ({ request }) => {
      // The markup as served, not as parsed: a `<` in the script's text could close it.
      const html = await (await request.get(path)).text();
      const match = html.match(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
      );

      expect(match?.[1]).toBeTruthy();
      expect(match?.[1]).not.toContain('<');
    });
  }

  const OTHER_PAGES = [
    ...PAGES.map(({ path }) => path).filter(
      (path) => !HOME_PERSONS.some((home) => home.path === path),
    ),
    '/404',
    '/es/404/',
    '/no-such-page',
  ];

  for (const path of OTHER_PAGES) {
    test(`${path} has none`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator(JSON_LD_SCRIPT)).toHaveCount(0);
    });
  }
});

// The 404 pages answer 200 at `/404` and `/es/404/` (plain assets), and 404 at every other
// address: either way they are not pages to index, and they have no address of their own to
// call canonical or to share.
test.describe('error pages', () => {
  for (const { lang, path } of [
    { lang: 'en', path: '/404' },
    { lang: 'es', path: '/es/404/' },
    { lang: 'en', path: '/no-such-page' },
    { lang: 'es', path: '/es/no-such-page' },
  ] as const) {
    test(`${path} asks not to be indexed and has no canonical link`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      const robots = page.locator('meta[name="robots"]');
      await expect(robots).toHaveCount(1);
      await expect(robots).toHaveAttribute('content', 'noindex');
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    });

    test(`${path} has no Open Graph or Twitter tags`, async ({ page }) => {
      await page.goto(path);

      // The page is rendered, not blank: `lang` is the page's own.
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      expect(await socialTags(page)).toEqual([]);
    });
  }
});

// The file crawlers read first. It is a static file of the build, written from the endpoint
// src/pages/robots.txt.ts.
test.describe('robots.txt', () => {
  test('lets every crawler in and names the sitemap index', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt');

    expect(response.status()).toBe(200);
    // A static file gets its header from the asset server, which chooses it by the file's
    // extension and spells the charset its own way (the endpoint's own header is not used).
    // What matters to a crawler is the media type, so that is all this holds it to.
    expect(response.headers()['content-type']).toMatch(/^text\/plain\b/);
    expect(await response.text()).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`,
    );
  });
});

// The sitemap is a static file of the build too: `@astrojs/sitemap` writes it from the site's
// routes once the build is done.

// The drafts have an entry but no page (see projects-detail.spec.ts).
const DRAFT_PROJECT_SLUGS = ['hagalo-verde', 'marielis'];

const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

/** An XML element, flattened so that it can cross from the browser to this file. */
interface XmlElement {
  /** The namespace the element is in, and its name without the prefix. */
  namespace: string | null;
  name: string;
  attributes: Record<string, string>;
  /** The text of an element with no child elements; empty for the others. */
  text: string;
  children: XmlElement[];
}

/**
 * Parses a document with the browser's XML parser, which refuses a document that is not
 * well-formed. Node has no XML parser of its own, and one written over the response text
 * would be one more thing to trust.
 */
async function parseXml(page: Page, xml: string): Promise<XmlElement> {
  return page.evaluate((source) => {
    const parsed = new DOMParser().parseFromString(source, 'application/xml');
    const failure = parsed.getElementsByTagName('parsererror')[0];
    if (failure) {
      throw new Error(
        `The document is not well-formed XML: ${failure.textContent}`,
      );
    }

    const flatten = (element: Element): XmlElement => ({
      namespace: element.namespaceURI,
      name: element.localName,
      attributes: Object.fromEntries(
        Array.from(element.attributes, (attribute): [string, string] => [
          attribute.name,
          attribute.value,
        ]),
      ),
      text: element.children.length === 0 ? (element.textContent ?? '') : '',
      children: Array.from(element.children, (child) => flatten(child)),
    });

    return flatten(parsed.documentElement);
  }, xml);
}

/** A document of the site that is served as XML, read through the test server. */
async function getXml(
  page: Page,
  request: APIRequestContext,
  pathname: string,
): Promise<XmlElement> {
  const response = await request.get(pathname);

  expect(response.status(), pathname).toBe(200);
  expect(response.headers()['content-type'], pathname).toMatch(
    /^(?:application|text)\/xml\b/,
  );

  return parseXml(page, await response.text());
}

function isElement(
  element: XmlElement,
  namespace: string,
  name: string,
): boolean {
  return element.namespace === namespace && element.name === name;
}

/** The address of every sitemap that the index names. */
async function readSitemapIndex(
  page: Page,
  request: APIRequestContext,
): Promise<string[]> {
  const index = await getXml(page, request, '/sitemap-index.xml');

  expect(index).toMatchObject({
    namespace: SITEMAP_NAMESPACE,
    name: 'sitemapindex',
  });

  return index.children.map((sitemap) => {
    expect(sitemap).toMatchObject({
      namespace: SITEMAP_NAMESPACE,
      name: 'sitemap',
    });
    expect(sitemap.children.map(({ name }) => name)).toEqual(['loc']);

    return sitemap.children[0]?.text ?? '';
  });
}

interface SitemapUrl {
  loc: string;
  alternates: { hreflang: string; href: string }[];
  /** The names of the children that are neither the `<loc>` nor an alternate link. */
  otherFields: string[];
}

/** Every `<url>` of the site's sitemap, reached the way a crawler reaches it: from the index. */
async function readSitemap(
  page: Page,
  request: APIRequestContext,
): Promise<SitemapUrl[]> {
  const [sitemap = ''] = await readSitemapIndex(page, request);

  // The index names the file on the production host. The test server has it at the same
  // pathname, so the request goes there.
  const urlset = await getXml(page, request, new URL(sitemap).pathname);

  expect(urlset).toMatchObject({
    namespace: SITEMAP_NAMESPACE,
    name: 'urlset',
  });

  return urlset.children.map((url) => {
    expect(url).toMatchObject({ namespace: SITEMAP_NAMESPACE, name: 'url' });

    const locs = url.children.filter((child) =>
      isElement(child, SITEMAP_NAMESPACE, 'loc'),
    );
    const links = url.children.filter((child) =>
      isElement(child, XHTML_NAMESPACE, 'link'),
    );
    expect(locs).toHaveLength(1);
    for (const link of links) {
      expect(link.attributes['rel']).toBe('alternate');
    }

    return {
      loc: locs[0]?.text ?? '',
      alternates: links.map(({ attributes }) => ({
        hreflang: attributes['hreflang'] ?? '',
        href: attributes['href'] ?? '',
      })),
      otherFields: url.children
        .filter((child) => !locs.includes(child) && !links.includes(child))
        .map(({ name }) => name),
    };
  });
}

function byHreflang(a: { hreflang: string }, b: { hreflang: string }): number {
  return a.hreflang.localeCompare(b.hreflang);
}

test.describe('sitemap', () => {
  test('is announced by an index that names it on the site', async ({
    page,
    request,
  }) => {
    expect(await readSitemapIndex(page, request)).toEqual([
      `${SITE_URL}/sitemap-0.xml`,
    ]);
  });

  // `PAGES` is the table that the first test of this file ties to the build, so a page that
  // is added to or dropped from the site fails there, and the sitemap is held to the same list.
  test('lists every indexable page of the site, once, and nothing else', async ({
    page,
    request,
  }) => {
    const urls = await readSitemap(page, request);

    expect(urls.map(({ loc }) => loc).sort()).toEqual(
      PAGES.map(({ path }) => `${SITE_URL}${path}`).sort(),
    );
  });

  test('leaves out the 404 pages, the CV routes and the draft projects', async ({
    page,
    request,
  }) => {
    const pathnames = (await readSitemap(page, request)).map(
      ({ loc }) => new URL(loc).pathname,
    );

    expect(
      pathnames.filter((pathname) => /\/404(?:\.html|\/)?$/.test(pathname)),
      'the 404 pages',
    ).toEqual([]);
    expect(
      pathnames.filter((pathname) => pathname.includes('/cv/')),
      'the CV routes',
    ).toEqual([]);
    expect(
      pathnames.filter((pathname) =>
        DRAFT_PROJECT_SLUGS.some((slug) => pathname.includes(`/${slug}/`)),
      ),
      'the draft projects',
    ).toEqual([]);
  });

  // Google ignores `changefreq` and `priority`, and trusts `lastmod` only when it is accurate,
  // which the date of a build is not.
  test('sets no lastmod, changefreq or priority', async ({ page, request }) => {
    const urls = await readSitemap(page, request);

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.flatMap(({ otherFields }) => otherFields)).toEqual([]);
  });

  for (const { path } of PAGES) {
    test(`${path} is listed once, at its canonical address, with the alternates of its head`, async ({
      page,
      request,
    }) => {
      const urls = await readSitemap(page, request);

      await page.goto(path);
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute('href');
      const headAlternates = await page
        .locator('link[rel="alternate"]')
        .evaluateAll((links) =>
          links.map((link) => ({
            hreflang: link.getAttribute('hreflang') ?? '',
            href: link.getAttribute('href') ?? '',
          })),
        );

      expect(canonical).toBe(`${SITE_URL}${path}`);
      // The comparison below must not pass on an empty head.
      expect(headAlternates.map(({ hreflang }) => hreflang).sort()).toEqual([
        'en',
        'es',
        'x-default',
      ]);

      const entries = urls.filter(({ loc }) => loc === canonical);
      expect(entries).toHaveLength(1);
      expect([...(entries[0]?.alternates ?? [])].sort(byHreflang)).toEqual(
        [...headAlternates].sort(byHreflang),
      );
    });
  }
});
