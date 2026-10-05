import { test, expect } from '@playwright/test';

// External links (absolute http/https) open in a new tab and say so; every other link,
// the CV download and the mailto: links included, stays in the same tab. See `Link.astro`
// and `isExternalHref`.
//
// Each page is checked link by link, not against a fixed list: an external link added
// later (a new project, a new profile link) is caught as soon as it renders without the
// new-tab attributes. The same CSS selector says which anchors count as external, on
// purpose: it is what an author would write to find them.
const EXTERNAL_LINK = 'a[href^="http://"], a[href^="https://"]';

const HINTS = {
  en: '(opens in a new tab)',
  es: '(se abre en una pestaña nueva)',
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `minimumExternalLinks` is a floor, not the list: it keeps the walk from passing without
// having looked at anything (say, if the selector stopped matching), while a link added
// later is still checked. The footer's GitHub and LinkedIn links are on every page.
const pages: {
  path: string;
  lang: 'en' | 'es';
  minimumExternalLinks: number;
}[] = [
  // Footer, the WhatsApp, LinkedIn and GitHub CTAs, and 3 featured cards with a live
  // site and a repository each.
  { path: '/', lang: 'en', minimumExternalLinks: 2 + 3 + 3 * 2 },
  { path: '/es/', lang: 'es', minimumExternalLinks: 2 + 3 + 3 * 2 },
  // Footer and 4 cards with a live site and a repository each.
  { path: '/projects/', lang: 'en', minimumExternalLinks: 2 + 4 * 2 },
  { path: '/es/projects/', lang: 'es', minimumExternalLinks: 2 + 4 * 2 },
  // "pysa", like projects-detail.spec.ts: it has both a live site and a repository.
  { path: '/projects/pysa/', lang: 'en', minimumExternalLinks: 2 + 2 },
  { path: '/es/projects/pysa/', lang: 'es', minimumExternalLinks: 2 + 2 },
  { path: '/experience/', lang: 'en', minimumExternalLinks: 2 },
  { path: '/es/experience/', lang: 'es', minimumExternalLinks: 2 },
  { path: '/skills/', lang: 'en', minimumExternalLinks: 2 },
  { path: '/es/skills/', lang: 'es', minimumExternalLinks: 2 },
  // Footer, and the WhatsApp link among the direct ways to write.
  { path: '/contact/', lang: 'en', minimumExternalLinks: 2 + 1 },
  { path: '/es/contact/', lang: 'es', minimumExternalLinks: 2 + 1 },
];

for (const { path, lang, minimumExternalLinks } of pages) {
  test.describe(`external links on ${path}`, () => {
    test('every http(s) link opens in a new tab and says so', async ({
      page,
    }) => {
      await page.goto(path);

      const links = page.locator(EXTERNAL_LINK);
      expect(await links.count()).toBeGreaterThanOrEqual(minimumExternalLinks);

      // A visible name, one space, then the hint: "GitHub (opens in a new tab)".
      const endsWithHint = new RegExp(`\\S ${escapeRegExp(HINTS[lang])}$`);

      for (const link of await links.all()) {
        const href = await link.getAttribute('href');

        await expect(link, `target of ${href}`).toHaveAttribute(
          'target',
          '_blank',
        );
        await expect(link, `rel of ${href}`).toHaveAttribute(
          'rel',
          /(^|\s)noopener(\s|$)/,
        );
        // The accessible name alone cannot prove the space: a browser adds one around a
        // block-level child such as the clipped, absolutely positioned hint, so the name
        // reads well even if the markup does not. The text content is the markup's own, and
        // it is there for every link, shown or not.
        await expect(link, `text of ${href}`).toHaveText(endsWithHint);

        // A link CSS hides while JavaScript runs (the contact page's notice for a visitor
        // without JavaScript, whose rules are in global.css) has no accessible name or box
        // to ask for; it is still checked above, since that visitor reads it.
        if (!(await link.isVisible())) {
          continue;
        }

        await expect(link, `accessible name of ${href}`).toHaveAccessibleName(
          endsWithHint,
        );

        // Visually hidden: clipped to a pixel, so it takes up no room. A hint that shows
        // would change the layout. (One taken out of the page with `display: none` is
        // already caught by the accessible name above.)
        const hintBox = await link.getByText(HINTS[lang]).boundingBox();
        expect(hintBox?.width, `hint width of ${href}`).toBeLessThanOrEqual(1);
        expect(hintBox?.height, `hint height of ${href}`).toBeLessThanOrEqual(
          1,
        );
      }
    });

    test('no other link has a target', async ({ page }) => {
      await page.goto(path);

      // Internal links, mailto: and the CV download: a new tab would break the back
      // button, or stay blank behind a mail client or a download.
      await expect(
        page.locator('a[target]:not([href^="http://"], [href^="https://"])'),
      ).toHaveCount(0);
    });
  });
}
