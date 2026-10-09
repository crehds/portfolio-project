import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// An address the site has no page for answers 404 with the error page of its locale: an
// address under `/es/` gets the Spanish page, every other address the English one. Both pages
// are prerendered, so the Worker fetches the right one from the static assets and answers
// with the 404 status. Which page it fetches is Astro's choice (it prefers `/<locale>/404`
// for an address under `/<locale>/`, when that page exists), which its docs do not describe;
// this spec is what proves it holds for the server under test.

interface NotFoundLocale {
  lang: 'en' | 'es';
  /** Addresses with no page behind them, of every kind the site can be asked for. */
  paths: string[];
  title: string;
  heading: string;
  homeLabel: string;
  homePath: string;
  projectsLabel: string;
  projectsPath: string;
  primaryNavLabel: string;
  switcherLabel: string;
  currentLanguage: string;
  other: { name: string; lang: 'en' | 'es'; homePath: string };
}

const locales: NotFoundLocale[] = [
  {
    lang: 'en',
    paths: [
      '/no-such-page',
      '/projects/no-such-project/',
      '/a/b/c',
      // A draft project: its entry exists, but no page is generated for it.
      '/projects/hagalo-verde/',
      // Starts with the Spanish code, but is not under `/es/`.
      '/escape/',
    ],
    title: 'Page not found — Carlos Rodríguez Huerta',
    heading: 'Page not found',
    homeLabel: 'Go to the home page',
    homePath: '/',
    projectsLabel: 'See the projects',
    projectsPath: '/projects/',
    primaryNavLabel: 'Primary navigation',
    switcherLabel: 'Language switcher',
    currentLanguage: 'English',
    other: { name: 'Español', lang: 'es', homePath: '/es/' },
  },
  {
    lang: 'es',
    paths: [
      '/es/no-such-page',
      '/es/projects/no-such-project/',
      '/es/a/b/c',
      '/es/projects/hagalo-verde/',
    ],
    title: 'Página no encontrada — Carlos Rodríguez Huerta',
    heading: 'Página no encontrada',
    homeLabel: 'Ir al inicio',
    homePath: '/es/',
    projectsLabel: 'Ver los proyectos',
    projectsPath: '/es/projects/',
    primaryNavLabel: 'Navegación principal',
    switcherLabel: 'Selector de idioma',
    currentLanguage: 'Español',
    other: { name: 'English', lang: 'en', homePath: '/' },
  },
];

/**
 * Opens an address and waits for the error page's own heading. Every check below is about
 * that page, so a check that fails here says the page is not what was served, and one that
 * looks for something missing (a link, an attribute) cannot pass on some other page.
 */
async function open(page: Page, path: string, heading: string) {
  const response = await page.goto(path);
  await expect(
    page.getByRole('heading', { level: 1, name: heading }),
  ).toBeVisible();
  return response;
}

for (const locale of locales) {
  const { lang, title, heading, other } = locale;

  for (const path of locale.paths) {
    test.describe(`not found: ${path}`, () => {
      test('answers 404 with the error page in its locale', async ({
        page,
      }) => {
        const response = await open(page, path, heading);

        expect(response?.status()).toBe(404);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await expect(page).toHaveTitle(title);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      });

      test('links to the home page and the projects list', async ({ page }) => {
        await open(page, path, heading);

        const main = page.getByRole('main');
        const home = main.getByRole('link', { name: locale.homeLabel });
        const projects = main.getByRole('link', { name: locale.projectsLabel });
        await expect(home).toHaveAttribute('href', locale.homePath);
        await expect(projects).toHaveAttribute('href', locale.projectsPath);

        // The address can be any depth, so the link must work from there.
        await projects.click();
        await expect(page).toHaveURL(
          (url) => url.pathname === locale.projectsPath,
        );
      });

      test('declares no hreflang alternates', async ({ page }) => {
        await open(page, path, heading);

        await expect(
          page.locator('link[rel="alternate"][hreflang]'),
        ).toHaveCount(0);
      });

      test("sends the language switcher to the other locale's home page", async ({
        page,
      }) => {
        await open(page, path, heading);

        const switcher = page.getByRole('navigation', {
          name: locale.switcherLabel,
        });
        await expect(
          switcher.getByRole('link', { name: locale.currentLanguage }),
        ).toHaveCount(0);
        await expect(switcher.locator('[aria-current="true"]')).toHaveText(
          locale.currentLanguage,
        );

        const otherLink = switcher.getByRole('link', { name: other.name });
        await expect(otherLink).toHaveAttribute('href', other.homePath);
        await expect(otherLink).toHaveAttribute('hreflang', other.lang);
        await expect(otherLink).toHaveAttribute('lang', other.lang);

        await otherLink.click();
        await expect(page).toHaveURL((url) => url.pathname === other.homePath);
        await expect(page.locator('html')).toHaveAttribute('lang', other.lang);
      });

      test('marks no navigation item as current', async ({ page }) => {
        await open(page, path, heading);

        const nav = page.getByRole('navigation', {
          name: locale.primaryNavLabel,
        });
        await expect(nav.getByRole('link').first()).toBeVisible();
        await expect(nav.locator('[aria-current]')).toHaveCount(0);
      });
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no detectable accessibility violations (${lang}, ${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await open(page, locale.paths[0], heading);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
}
