import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SITE = 'https://portfolio-project.carlos15erh.workers.dev';
const DASH = '–'; // en dash, exact separator `formatPeriod` joins labels with.

interface RoleExpectation {
  company: string;
  highlightCount: number;
  periodPattern: RegExp;
}

const locales: {
  lang: 'en' | 'es';
  path: string;
  primaryNavLabel: string;
  experienceLabel: string;
  headingText: string;
  roles: RoleExpectation[];
  firstRole: { type: string; location: string; stackTag: string };
}[] = [
  {
    lang: 'en',
    path: '/experience/',
    primaryNavLabel: 'Primary navigation',
    experienceLabel: 'Experience',
    headingText: 'Experience',
    // In domain order (see src/modules/experience/domain/sort-experience.ts): current
    // role first, then by end date desc, then by start date desc - matches
    // src/content/experience.yaml.
    roles: [
      {
        company: 'FullStack Labs',
        highlightCount: 6,
        periodPattern: new RegExp(`^May 2024 ${DASH} Present$`),
      },
      {
        company: 'TechyWe',
        highlightCount: 5,
        periodPattern: new RegExp(`^Jan 2023 ${DASH} Apr 2024$`),
      },
      {
        company: 'Freelance',
        highlightCount: 3,
        periodPattern: new RegExp(`^Oct 2020 ${DASH} Jan 2023$`),
      },
      {
        company: 'EICHE',
        highlightCount: 3,
        periodPattern: new RegExp(`^Feb 2019 ${DASH} Jun 2019$`),
      },
      {
        company: 'Freelance',
        highlightCount: 1,
        periodPattern: new RegExp(`^Nov 2018 ${DASH} Jan 2019$`),
      },
    ],
    firstRole: {
      type: 'Full-time',
      location: 'United States',
      stackTag: 'Next.js',
    },
  },
  {
    lang: 'es',
    path: '/es/experience/',
    primaryNavLabel: 'Navegación principal',
    experienceLabel: 'Experiencia',
    headingText: 'Experiencia',
    roles: [
      {
        company: 'FullStack Labs',
        highlightCount: 6,
        periodPattern: new RegExp(`^may\\.? 2024 ${DASH} Actualidad$`, 'i'),
      },
      {
        company: 'TechyWe',
        highlightCount: 5,
        periodPattern: new RegExp(`^ene\\.? 2023 ${DASH} abr\\.? 2024$`, 'i'),
      },
      {
        company: 'Freelance',
        highlightCount: 3,
        periodPattern: new RegExp(`^oct\\.? 2020 ${DASH} ene\\.? 2023$`, 'i'),
      },
      {
        company: 'EICHE',
        highlightCount: 3,
        periodPattern: new RegExp(`^feb\\.? 2019 ${DASH} jun\\.? 2019$`, 'i'),
      },
      {
        company: 'Freelance',
        highlightCount: 1,
        periodPattern: new RegExp(`^nov\\.? 2018 ${DASH} ene\\.? 2019$`, 'i'),
      },
    ],
    firstRole: {
      type: 'Tiempo completo',
      location: 'Estados Unidos',
      stackTag: 'Next.js',
    },
  },
];

for (const {
  lang,
  path,
  primaryNavLabel,
  experienceLabel,
  headingText,
  roles,
  firstRole,
} of locales) {
  test.describe(`experience page (${lang})`, () => {
    test('has exactly one h1 with the page heading', async ({ page }) => {
      await page.goto(path);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveCount(1);
      await expect(heading).toHaveText(headingText);
    });

    test("shows the years-of-experience line matching the computed value's format", async ({
      page,
    }) => {
      await page.goto(path);

      const pattern =
        lang === 'en'
          ? /^(?:\d+\+ years? of experience|Less than a year of experience)$/
          : /^(?:Más de \d+ años? de experiencia|Menos de un año de experiencia)$/;

      await expect(page.getByTestId('years-of-experience')).toHaveText(pattern);
    });

    test('groups the years line with the heading and keeps the timeline at a distance', async ({
      page,
    }) => {
      await page.goto(path);

      // Vertical gaps in CSS px from `getBoundingClientRect`, all read in one page turn.
      const gaps = await page.evaluate(() => {
        const rect = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Missing element: ${selector}`);
          return element.getBoundingClientRect();
        };
        const heading = rect('main h1');
        const yearsLine = rect('[data-testid="years-of-experience"]');
        const timeline = rect('main ol');

        return {
          headingToYears: yearsLine.top - heading.bottom,
          yearsToTimeline: timeline.top - yearsLine.bottom,
        };
      });

      // The years line is the heading's subtitle, so it sits close to the h1...
      expect(gaps.headingToYears).toBeGreaterThanOrEqual(4);
      expect(gaps.headingToYears).toBeLessThanOrEqual(16);
      // ...while the timeline keeps its own distance from that pair.
      expect(gaps.yearsToTimeline).toBeGreaterThanOrEqual(24);
    });

    test('lists exactly the 5 roles, as an ordered list, in domain order, with their periods and highlight counts', async ({
      page,
    }) => {
      await page.goto(path);

      // Semantic markup requirement: a real <ol>, not a styled <div>/<ul>.
      await expect(page.locator('main ol')).toHaveCount(1);

      // h2 under the page's h1: no skipped heading level.
      const companyHeadings = page.getByRole('heading', { level: 2 });
      await expect(companyHeadings).toHaveText(
        roles.map((role) => role.company),
      );

      const periods = page.getByTestId('experience-period');
      const highlightLists = page.getByTestId('experience-highlights');
      await expect(periods).toHaveCount(roles.length);
      await expect(highlightLists).toHaveCount(roles.length);

      for (let i = 0; i < roles.length; i++) {
        await expect(periods.nth(i)).toHaveText(roles[i].periodPattern);
        await expect(highlightLists.nth(i).getByRole('listitem')).toHaveCount(
          roles[i].highlightCount,
        );
      }
    });

    test('shows the employment type, location and stack for the first (current) role', async ({
      page,
    }) => {
      await page.goto(path);

      const firstEntry = page.getByTestId('experience-role').first();
      await expect(
        firstEntry.getByText(firstRole.type, { exact: true }),
      ).toHaveCount(1);
      await expect(
        firstEntry.getByText(firstRole.location, { exact: true }),
      ).toHaveCount(1);
      await expect(
        firstEntry.getByText(firstRole.stackTag, { exact: true }),
      ).toHaveCount(1);
    });

    test('marks the Experience nav item as the current page', async ({
      page,
    }) => {
      await page.goto(path);

      const nav = page.getByRole('navigation', { name: primaryNavLabel });
      const current = nav.getByRole('link', { name: experienceLabel });

      await expect(current).toHaveAttribute('aria-current', 'page');
    });

    test('declares the hreflang alternates on the site origin', async ({
      page,
    }) => {
      await page.goto(path);

      const otherPath = lang === 'en' ? '/es/experience/' : '/experience/';
      await expect(page.locator('link[rel="alternate"]')).toHaveCount(3);
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]'),
      ).toHaveAttribute('href', `${SITE}${lang === 'en' ? path : otherPath}`);
      await expect(
        page.locator('link[rel="alternate"][hreflang="es"]'),
      ).toHaveAttribute('href', `${SITE}${lang === 'es' ? path : otherPath}`);
      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]'),
      ).toHaveAttribute('href', `${SITE}${lang === 'en' ? path : otherPath}`);
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
