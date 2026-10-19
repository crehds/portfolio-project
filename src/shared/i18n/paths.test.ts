import { describe, expect, it } from 'vitest';

import { SITE_URL } from '../site/site-url';
import {
  canonicalHref,
  hreflangAlternates,
  localeOfPathname,
  pathnameInLocale,
  pathnameIsWithinSection,
  pathnamesMatch,
} from './paths';

describe('localeOfPathname', () => {
  it('treats the unprefixed root as the default locale', () => {
    expect(localeOfPathname('/')).toBe('en');
  });

  it('recognizes the spanish prefix', () => {
    expect(localeOfPathname('/es/')).toBe('es');
  });

  it('recognizes the spanish prefix on a nested path', () => {
    expect(localeOfPathname('/es/projects/x/')).toBe('es');
  });

  it('treats an unprefixed nested path as the default locale', () => {
    expect(localeOfPathname('/projects/x/')).toBe('en');
  });

  it('does not mistake a path that merely starts with a locale code for that locale', () => {
    expect(localeOfPathname('/escape/')).toBe('en');
  });
});

describe('pathnameInLocale', () => {
  it('converts the default-locale root to the spanish root', () => {
    expect(pathnameInLocale('/', 'es')).toBe('/es/');
  });

  it('converts the spanish root back to the default-locale root', () => {
    expect(pathnameInLocale('/es/', 'en')).toBe('/');
  });

  it('converts a nested default-locale path to spanish', () => {
    expect(pathnameInLocale('/projects/x/', 'es')).toBe('/es/projects/x/');
  });

  it('converts a nested spanish path back to the default locale', () => {
    expect(pathnameInLocale('/es/projects/x/', 'en')).toBe('/projects/x/');
  });

  it('is idempotent when the pathname is already in the target locale', () => {
    expect(pathnameInLocale('/es/', 'es')).toBe('/es/');
    expect(pathnameInLocale('/projects/x/', 'en')).toBe('/projects/x/');
  });

  it('does not mistake a path that merely starts with a locale code for that locale', () => {
    expect(pathnameInLocale('/escape/', 'es')).toBe('/es/escape/');
    expect(pathnameInLocale('/es/escape/', 'en')).toBe('/escape/');
  });
});

describe('pathnamesMatch', () => {
  it('treats a pathname with and without a trailing slash as the same page', () => {
    expect(pathnamesMatch('/es', '/es/')).toBe(true);
    expect(pathnamesMatch('/es/', '/es')).toBe(true);
  });

  it('treats the unprefixed root and an empty path as the same page', () => {
    expect(pathnamesMatch('/', '')).toBe(true);
  });

  it('returns false for genuinely different pages', () => {
    expect(pathnamesMatch('/es/', '/')).toBe(false);
    expect(pathnamesMatch('/projects/x/', '/projects/y/')).toBe(false);
  });
});

describe('pathnameIsWithinSection', () => {
  it('treats the exact section page as within itself', () => {
    expect(pathnameIsWithinSection('/projects/', '/projects/')).toBe(true);
  });

  it('treats a nested page as within its section', () => {
    expect(
      pathnameIsWithinSection('/projects/game-with-keyboard/', '/projects/'),
    ).toBe(true);
  });

  it('is trailing-slash-safe, like pathnamesMatch', () => {
    expect(pathnameIsWithinSection('/projects', '/projects/')).toBe(true);
    expect(
      pathnameIsWithinSection('/projects/game-with-keyboard', '/projects/'),
    ).toBe(true);
  });

  it('respects the locale prefix on both sides', () => {
    expect(pathnameIsWithinSection('/es/projects/pysa/', '/es/projects/')).toBe(
      true,
    );
  });

  it('returns false for an unrelated top-level page', () => {
    expect(pathnameIsWithinSection('/experience/', '/projects/')).toBe(false);
  });

  it('never treats another page as within the home section', () => {
    // The root has no nested pages under this definition: only an exact match counts
    // as "home", so every other top-level page isn't a false-positive descendant of it.
    expect(pathnameIsWithinSection('/projects/', '/')).toBe(false);
    expect(pathnameIsWithinSection('/', '/')).toBe(true);
  });
});

describe('hreflangAlternates', () => {
  it('lists absolute urls for every locale plus x-default on the site origin', () => {
    expect(hreflangAlternates('/', SITE_URL)).toEqual([
      { hreflang: 'en', href: `${SITE_URL}/` },
      { hreflang: 'es', href: `${SITE_URL}/es/` },
      { hreflang: 'x-default', href: `${SITE_URL}/` },
    ]);
  });

  it('resolves alternates from a spanish, nested pathname', () => {
    expect(hreflangAlternates('/es/projects/x/', SITE_URL)).toEqual([
      { hreflang: 'en', href: `${SITE_URL}/projects/x/` },
      { hreflang: 'es', href: `${SITE_URL}/es/projects/x/` },
      { hreflang: 'x-default', href: `${SITE_URL}/projects/x/` },
    ]);
  });
});

describe('canonicalHref', () => {
  it('points the root at the site origin', () => {
    expect(canonicalHref('/', SITE_URL)).toBe(`${SITE_URL}/`);
  });

  it('points a nested page at its own slash-terminated address', () => {
    expect(canonicalHref('/projects/pysa/', SITE_URL)).toBe(
      `${SITE_URL}/projects/pysa/`,
    );
  });

  it('adds the trailing slash a folder index is served with', () => {
    // Cloudflare serves `/projects/pysa/` and answers `/projects/pysa` with a 307, so the
    // canonical is the slash-terminated form whichever one was asked for.
    expect(canonicalHref('/projects/pysa', SITE_URL)).toBe(
      `${SITE_URL}/projects/pysa/`,
    );
    expect(canonicalHref('/es', SITE_URL)).toBe(`${SITE_URL}/es/`);
  });

  it('leaves a query string and a hash out', () => {
    expect(canonicalHref('/contact/?sent=1', SITE_URL)).toBe(
      `${SITE_URL}/contact/`,
    );
    expect(canonicalHref('/contact?_action=contact', SITE_URL)).toBe(
      `${SITE_URL}/contact/`,
    );
    expect(canonicalHref('/projects/pysa/#features', SITE_URL)).toBe(
      `${SITE_URL}/projects/pysa/`,
    );
    expect(canonicalHref('/es/projects/?page=2#top', SITE_URL)).toBe(
      `${SITE_URL}/es/projects/`,
    );
  });

  it('keeps the spanish prefix', () => {
    expect(canonicalHref('/es/', SITE_URL)).toBe(`${SITE_URL}/es/`);
    expect(canonicalHref('/es/projects/pysa/', SITE_URL)).toBe(
      `${SITE_URL}/es/projects/pysa/`,
    );
  });

  it('does not mistake a path that merely starts with a locale code for that locale', () => {
    expect(canonicalHref('/escape/', SITE_URL)).toBe(`${SITE_URL}/escape/`);
  });

  it('is built from the site it is given, with or without a trailing slash', () => {
    // `Astro.site.href` ends with a slash; the constant does not.
    expect(canonicalHref('/projects/', 'https://example.com')).toBe(
      'https://example.com/projects/',
    );
    expect(canonicalHref('/projects/', 'https://example.com/')).toBe(
      'https://example.com/projects/',
    );
  });

  it("equals the page's own hreflang alternate", () => {
    for (const pathname of [
      '/',
      '/es/',
      '/projects/',
      '/es/projects/pysa/',
      '/contact',
      '/es/skills',
    ]) {
      const own = hreflangAlternates(pathname, SITE_URL).find(
        (alternate) => alternate.hreflang === localeOfPathname(pathname),
      );

      expect(own, pathname).toBeDefined();
      expect(canonicalHref(pathname, SITE_URL), pathname).toBe(own?.href);
    }
  });
});
