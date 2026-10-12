import { expect } from '@playwright/test';
import { test } from './support/csp-guard';
import AxeBuilder from '@axe-core/playwright';

import { SITE_URL } from '../src/shared/site/site-url';

interface CategoryExpectation {
  heading: string;
  count: number;
}

const locales: {
  lang: 'en' | 'es';
  path: string;
  primaryNavLabel: string;
  skillsLabel: string;
  headingText: string;
  // In SKILL_CATEGORIES order (src/modules/skills/domain/categories.ts), with counts
  // from src/content/skills.yaml.
  categories: CategoryExpectation[];
}[] = [
  {
    lang: 'en',
    path: '/skills/',
    primaryNavLabel: 'Primary navigation',
    skillsLabel: 'Skills',
    headingText: 'Skills',
    categories: [
      { heading: 'Frontend', count: 8 },
      { heading: 'Backend', count: 7 },
      { heading: 'Data', count: 5 },
      { heading: 'DevOps', count: 10 },
      { heading: 'Testing', count: 8 },
      { heading: 'Tools', count: 3 },
    ],
  },
  {
    lang: 'es',
    path: '/es/skills/',
    primaryNavLabel: 'Navegación principal',
    skillsLabel: 'Habilidades',
    headingText: 'Habilidades',
    categories: [
      { heading: 'Frontend', count: 8 },
      { heading: 'Backend', count: 7 },
      { heading: 'Datos', count: 5 },
      { heading: 'DevOps', count: 10 },
      { heading: 'Testing', count: 8 },
      { heading: 'Herramientas', count: 3 },
    ],
  },
];

for (const {
  lang,
  path,
  primaryNavLabel,
  skillsLabel,
  headingText,
  categories,
} of locales) {
  test.describe(`skills page (${lang})`, () => {
    test('has exactly one h1 with the page heading', async ({ page }) => {
      await page.goto(path);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveCount(1);
      await expect(heading).toHaveText(headingText);
    });

    test('shows the 6 category headings in order, each with the right skill count', async ({
      page,
    }) => {
      await page.goto(path);

      const categoryHeadings = page.getByRole('heading', { level: 2 });
      await expect(categoryHeadings).toHaveText(
        categories.map((category) => category.heading),
      );

      for (const { heading, count } of categories) {
        const headingLocator = page.getByRole('heading', {
          level: 2,
          name: heading,
          exact: true,
        });
        const section = page.locator('section').filter({ has: headingLocator });
        await expect(section.getByRole('listitem')).toHaveCount(count);
      }
    });

    test('marks the Skills nav item as the current page', async ({ page }) => {
      await page.goto(path);

      const nav = page.getByRole('navigation', { name: primaryNavLabel });
      const current = nav.getByRole('link', { name: skillsLabel });

      await expect(current).toHaveAttribute('aria-current', 'page');
    });

    test('declares the hreflang alternates on the site origin', async ({
      page,
    }) => {
      await page.goto(path);

      const otherPath = lang === 'en' ? '/es/skills/' : '/skills/';
      await expect(page.locator('link[rel="alternate"]')).toHaveCount(3);
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]'),
      ).toHaveAttribute(
        'href',
        `${SITE_URL}${lang === 'en' ? path : otherPath}`,
      );
      await expect(
        page.locator('link[rel="alternate"][hreflang="es"]'),
      ).toHaveAttribute(
        'href',
        `${SITE_URL}${lang === 'es' ? path : otherPath}`,
      );
      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]'),
      ).toHaveAttribute(
        'href',
        `${SITE_URL}${lang === 'en' ? path : otherPath}`,
      );
    });

    for (const colorScheme of ['light', 'dark'] as const) {
      test(`has no detectable accessibility violations (${colorScheme})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(results.violations).toEqual([]);
      });
    }
  });
}
