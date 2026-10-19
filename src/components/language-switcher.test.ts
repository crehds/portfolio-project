import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import LanguageSwitcher from './LanguageSwitcher.astro';

// The switcher is self-contained: it reads the page's address from the request, so a
// request for that address is all the container needs, besides `errorPage`.

async function render(pathname: string, errorPage?: boolean): Promise<string> {
  const container = await AstroContainer.create();

  return container.renderToString(LanguageSwitcher, {
    request: new Request(`http://localhost${pathname}`),
    props: { errorPage },
  });
}

/** The raw value of an attribute of an opening tag. */
function attributeOf(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

/** Every link in the switcher: where it goes and the language it says it is in. */
function links(html: string) {
  return [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => ({
    href: attributeOf(tag, 'href'),
    hreflang: attributeOf(tag, 'hreflang'),
    lang: attributeOf(tag, 'lang'),
  }));
}

describe('LanguageSwitcher', () => {
  it('links to the same page in the other locale', async () => {
    expect(links(await render('/projects/'))).toEqual([
      { href: '/es/projects/', hreflang: 'es', lang: 'es' },
    ]);
    expect(links(await render('/es/projects/'))).toEqual([
      { href: '/projects/', hreflang: 'en', lang: 'en' },
    ]);
  });

  describe('on an error page', () => {
    it('links to the home page of the other locale', async () => {
      expect(links(await render('/404', true))).toEqual([
        { href: '/es/', hreflang: 'es', lang: 'es' },
      ]);
      expect(links(await render('/es/404', true))).toEqual([
        { href: '/', hreflang: 'en', lang: 'en' },
      ]);
    });

    it('does so wherever the page is, not only at /404', async () => {
      expect(links(await render('/a/b/c/', true))).toEqual([
        { href: '/es/', hreflang: 'es', lang: 'es' },
      ]);
      expect(links(await render('/es/a/b/c/', true))).toEqual([
        { href: '/', hreflang: 'en', lang: 'en' },
      ]);
    });

    it('still shows the current language without linking to it', async () => {
      const html = await render('/es/404', true);

      expect(html.match(/aria-current="true"/g)).toHaveLength(1);
      expect(links(html)).toHaveLength(1);
    });
  });

  it('keeps linking to the same page when errorPage is false', async () => {
    expect(links(await render('/projects/', false))).toEqual([
      { href: '/es/projects/', hreflang: 'es', lang: 'es' },
    ]);
  });
});
