import { expect } from '@playwright/test';
import { test } from './support/csp-guard';
import AxeBuilder from '@axe-core/playwright';

import { SITE_URL } from '../src/shared/site/site-url';

const locales: {
  lang: 'en' | 'es';
  listPath: string;
  primaryNavLabel: string;
  projectsLabel: string;
  // The page's sections in order: client work, then the owner's own projects. Inside each,
  // the titles in domain order: featured first (date desc, slug tie-break), then the rest.
  expectedSections: { heading: string; titles: string[] }[];
  // Keyed by heading text (localized): every rendered card's title must link to its
  // own project page, not just the first one.
  expectedHrefByTitle: Record<string, string>;
}[] = [
  {
    lang: 'en',
    listPath: '/projects/',
    primaryNavLabel: 'Primary navigation',
    projectsLabel: 'Projects',
    expectedSections: [
      {
        heading: 'Freelance projects',
        titles: ['Yo te regalo', 'Automotriz MGRL', 'Nidito'],
      },
      {
        heading: 'Personal projects',
        titles: [
          'Expresión Latina',
          'Pysa',
          'Game With Keyboard',
          'Bachatealo',
        ],
      },
    ],
    expectedHrefByTitle: {
      'Expresión Latina': '/projects/expresion-latina/',
      Pysa: '/projects/pysa/',
      'Game With Keyboard': '/projects/game-with-keyboard/',
      'Yo te regalo': '/projects/yoteregalo/',
      'Automotriz MGRL': '/projects/automotrizmgrl/',
      Nidito: '/projects/nidito/',
      Bachatealo: '/projects/bachatealo/',
    },
  },
  {
    lang: 'es',
    listPath: '/es/projects/',
    primaryNavLabel: 'Navegación principal',
    projectsLabel: 'Proyectos',
    expectedSections: [
      {
        heading: 'Proyectos freelance',
        titles: ['Yo te regalo', 'Automotriz MGRL', 'Nidito'],
      },
      {
        heading: 'Proyectos propios',
        titles: [
          'Expresión Latina',
          'Pysa Gaming',
          'Juego con Teclado',
          'Bachatealo',
        ],
      },
    ],
    expectedHrefByTitle: {
      'Expresión Latina': '/es/projects/expresion-latina/',
      'Pysa Gaming': '/es/projects/pysa/',
      'Juego con Teclado': '/es/projects/game-with-keyboard/',
      'Yo te regalo': '/es/projects/yoteregalo/',
      'Automotriz MGRL': '/es/projects/automotrizmgrl/',
      Nidito: '/es/projects/nidito/',
      Bachatealo: '/es/projects/bachatealo/',
    },
  },
];

for (const {
  lang,
  listPath,
  primaryNavLabel,
  projectsLabel,
  expectedSections,
  expectedHrefByTitle,
} of locales) {
  const expectedTitles = expectedSections.flatMap(({ titles }) => titles);

  test.describe(`projects list page (${lang})`, () => {
    test('lists exactly the published projects, freelance work first then personal projects, with no drafts', async ({
      page,
    }) => {
      await page.goto(listPath);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('h1')).toHaveCount(1);

      const sections = page
        .getByTestId('projects-list-grid')
        .locator(':scope > section');
      await expect(sections).toHaveCount(expectedSections.length);

      for (const [index, { heading, titles }] of expectedSections.entries()) {
        const section = sections.nth(index);
        await expect(section.getByRole('heading', { level: 2 })).toHaveText(
          heading,
        );
        await expect(section.getByRole('heading', { level: 3 })).toHaveText(
          titles,
        );
      }
    });

    test('each card title links to its own project page', async ({ page }) => {
      await page.goto(listPath);

      const cardHeadings = page
        .getByTestId('projects-list-grid')
        .getByRole('heading', { level: 3 });

      // Every rendered card, not just the first: a wrong href on any later card must
      // fail this test too.
      await expect(cardHeadings).toHaveText(expectedTitles);

      for (let i = 0; i < expectedTitles.length; i++) {
        const cardHeading = cardHeadings.nth(i);
        const text = await cardHeading.innerText();
        const expectedHref = expectedHrefByTitle[text];
        if (!expectedHref) {
          throw new Error(`No expected project href recorded for "${text}".`);
        }

        await expect(cardHeading.getByRole('link')).toHaveAttribute(
          'href',
          expectedHref,
        );
      }
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
        `${SITE_URL}${lang === 'en' ? listPath : otherListPath}`,
      );
      await expect(
        page.locator('link[rel="alternate"][hreflang="es"]'),
      ).toHaveAttribute(
        'href',
        `${SITE_URL}${lang === 'es' ? listPath : otherListPath}`,
      );
      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]'),
      ).toHaveAttribute(
        'href',
        `${SITE_URL}${lang === 'en' ? listPath : otherListPath}`,
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
