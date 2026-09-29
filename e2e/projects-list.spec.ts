import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SITE = 'https://portfolio-project.carlos15erh.workers.dev';

const locales: {
  lang: 'en' | 'es';
  listPath: string;
  primaryNavLabel: string;
  projectsLabel: string;
  // In domain order: featured first (date desc, slug tie-break), then the rest.
  expectedTitles: string[];
}[] = [
  {
    lang: 'en',
    listPath: '/projects/',
    primaryNavLabel: 'Primary navigation',
    projectsLabel: 'Projects',
    expectedTitles: [
      'Expresión Latina',
      'Pysa',
      'Game With Keyboard',
      'Bachatealo',
    ],
  },
  {
    lang: 'es',
    listPath: '/es/projects/',
    primaryNavLabel: 'Navegación principal',
    projectsLabel: 'Proyectos',
    expectedTitles: [
      'Expresión Latina',
      'Pysa Gaming',
      'Juego con Teclado',
      'Bachatealo',
    ],
  },
];

for (const {
  lang,
  listPath,
  primaryNavLabel,
  projectsLabel,
  expectedTitles,
} of locales) {
  test.describe(`projects list page (${lang})`, () => {
    test('lists exactly the published projects, featured first then newest, with no drafts', async ({
      page,
    }) => {
      await page.goto(listPath);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('h1')).toHaveCount(1);

      const cardHeadings = page
        .getByTestId('projects-list-grid')
        .getByRole('heading', { level: 3 });
      await expect(cardHeadings).toHaveText(expectedTitles);
    });

    test('each card title links to its own project page', async ({ page }) => {
      await page.goto(listPath);

      const firstCardHeading = page
        .getByTestId('projects-list-grid')
        .getByRole('heading', { level: 3 })
        .first();
      const link = firstCardHeading.getByRole('link');

      await expect(link).toHaveAttribute(
        'href',
        lang === 'en'
          ? '/projects/expresion-latina/'
          : '/es/projects/expresion-latina/',
      );
    });

    test('marks the Projects nav item as the current page', async ({
      page,
    }) => {
      await page.goto(listPath);

      const nav = page.getByRole('navigation', { name: primaryNavLabel });
      const current = nav.getByRole('link', { name: projectsLabel });

      await expect(current).toHaveAttribute('aria-current', 'page');
    });

    test('declares the hreflang alternates on the site origin', async ({
      page,
    }) => {
      await page.goto(listPath);

      const otherListPath = lang === 'en' ? '/es/projects/' : '/projects/';
      await expect(page.locator('link[rel="alternate"]')).toHaveCount(3);
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]'),
      ).toHaveAttribute(
        'href',
        `${SITE}${lang === 'en' ? listPath : otherListPath}`,
      );
      await expect(
        page.locator('link[rel="alternate"][hreflang="es"]'),
      ).toHaveAttribute(
        'href',
        `${SITE}${lang === 'es' ? listPath : otherListPath}`,
      );
      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]'),
      ).toHaveAttribute(
        'href',
        `${SITE}${lang === 'en' ? listPath : otherListPath}`,
      );
    });

    for (const colorScheme of ['light', 'dark'] as const) {
      test(`has no detectable accessibility violations (${colorScheme})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(listPath);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(results.violations).toEqual([]);
      });
    }
  });
}
