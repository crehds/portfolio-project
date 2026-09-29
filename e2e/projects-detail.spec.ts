import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SITE = 'https://portfolio-project.carlos15erh.workers.dev';

const locales: {
  lang: 'en' | 'es';
  listPath: string;
  primaryNavLabel: string;
  projectsLabel: string;
  // "pysa" - published, featured, has a cover and both links - used as the
  // representative single project page per locale (scope item 8).
  detailPath: string;
  detailTitle: string;
  draftPath: string;
}[] = [
  {
    lang: 'en',
    listPath: '/projects/',
    primaryNavLabel: 'Primary navigation',
    projectsLabel: 'Projects',
    detailPath: '/projects/pysa/',
    detailTitle: 'Pysa',
    draftPath: '/projects/hagalo-verde/',
  },
  {
    lang: 'es',
    listPath: '/es/projects/',
    primaryNavLabel: 'Navegación principal',
    projectsLabel: 'Proyectos',
    detailPath: '/es/projects/pysa/',
    detailTitle: 'Pysa Gaming',
    draftPath: '/es/projects/hagalo-verde/',
  },
];

for (const {
  lang,
  listPath,
  primaryNavLabel,
  projectsLabel,
  detailPath,
  detailTitle,
  draftPath,
} of locales) {
  test.describe(`project detail page (${lang})`, () => {
    test('renders one h1, the cover with alt and explicit dimensions, and a working back link', async ({
      page,
    }) => {
      await page.goto(detailPath);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        detailTitle,
      );

      const cover = page.locator('main img');
      await expect(cover).toHaveCount(1);
      const alt = await cover.getAttribute('alt');
      expect(alt).toContain(detailTitle);
      const width = Number(await cover.getAttribute('width'));
      const height = Number(await cover.getAttribute('height'));
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);

      const backLink = page.getByRole('link', {
        name: lang === 'en' ? /back to projects/i : /volver a proyectos/i,
      });
      await expect(backLink).toHaveAttribute('href', listPath);
      await backLink.click();
      await expect(page).toHaveURL((url) => url.pathname === listPath);
    });

    test('declares the hreflang alternates on the site origin', async ({
      page,
    }) => {
      await page.goto(detailPath);

      const otherDetailPath =
        lang === 'en' ? '/es/projects/pysa/' : '/projects/pysa/';
      await expect(page.locator('link[rel="alternate"]')).toHaveCount(3);
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]'),
      ).toHaveAttribute(
        'href',
        `${SITE}${lang === 'en' ? detailPath : otherDetailPath}`,
      );
      await expect(
        page.locator('link[rel="alternate"][hreflang="es"]'),
      ).toHaveAttribute(
        'href',
        `${SITE}${lang === 'es' ? detailPath : otherDetailPath}`,
      );
    });

    test('marks the Projects nav item as within the current section, not as the exact current page', async ({
      page,
    }) => {
      await page.goto(detailPath);

      const nav = page.getByRole('navigation', { name: primaryNavLabel });
      const projectsLink = nav.getByRole('link', { name: projectsLabel });

      await expect(projectsLink).toHaveAttribute('aria-current', 'true');
    });

    test('has no detectable accessibility violations', async ({ page }) => {
      await page.goto(detailPath);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('has no detectable accessibility violations (dark)', async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(detailPath);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('a draft project slug has no page: 404', async ({ page }) => {
      const response = await page.goto(draftPath);

      expect(response?.status()).toBe(404);
    });
  });
}
