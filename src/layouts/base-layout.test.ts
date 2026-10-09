import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it, vi } from 'vitest';

import { localeOfPathname } from '../shared/i18n/paths';
import { getDictionary } from '../shared/i18n/ui';
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

const SITE = 'https://portfolio-project.carlos15erh.workers.dev';

async function render(pathname: string, errorPage?: boolean): Promise<string> {
  const container = await AstroContainer.create({
    astroConfig: { site: SITE },
  });

  return container.renderToString(BaseLayout, {
    request: new Request(`http://localhost${pathname}`),
    props: { title: 'A title', description: 'A description', errorPage },
    slots: { default: '<p>The page</p>' },
  });
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
      { hreflang: 'en', href: `${SITE}/projects/pysa/` },
      { hreflang: 'es', href: `${SITE}/es/projects/pysa/` },
      { hreflang: 'x-default', href: `${SITE}/projects/pysa/` },
    ]);
  });

  it('links the language switcher to the same page in the other locale', async () => {
    expect(await switcherHrefs('/projects/pysa/')).toEqual([
      '/es/projects/pysa/',
    ]);
  });

  describe('on an error page', () => {
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

    it("links the language switcher to the other locale's home page", async () => {
      expect(await switcherHrefs('/404', true)).toEqual(['/es/']);
      expect(await switcherHrefs('/es/404', true)).toEqual(['/']);
    });
  });
});
