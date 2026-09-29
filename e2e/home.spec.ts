import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SITE = 'https://portfolio-project.carlos15erh.workers.dev';

const homePages: { path: string; lang: string }[] = [
  { path: '/', lang: 'en' },
  { path: '/es/', lang: 'es' },
];

for (const { path, lang } of homePages) {
  test.describe(`home page (${lang})`, () => {
    test('has the expected landmarks and metadata', async ({ page }) => {
      await page.goto(path);

      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page).toHaveTitle(/.+/);
    });

    test('declares the hreflang alternates on the site origin', async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page.locator('link[rel="alternate"]')).toHaveCount(3);
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]'),
      ).toHaveAttribute('href', `${SITE}/`);
      await expect(
        page.locator('link[rel="alternate"][hreflang="es"]'),
      ).toHaveAttribute('href', `${SITE}/es/`);
      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]'),
      ).toHaveAttribute('href', `${SITE}/`);
    });

    test('has no detectable accessibility violations', async ({ page }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test("the h1 is the owner's name", async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Carlos Rodríguez Huerta',
      );
    });

    test("the years-of-experience line matches the computed value's format", async ({
      page,
    }) => {
      await page.goto(path);

      // Matches the localized template `formatYearsOfExperience` produces (see
      // `src/modules/experience/domain/format-years-of-experience.ts`) without pinning the
      // actual number, which grows as real experience accrues.
      const pattern =
        lang === 'en'
          ? /^(?:\d+\+ years? of experience|Less than a year of experience)$/
          : /^(?:Más de \d+ años? de experiencia|Menos de un año de experiencia)$/;

      await expect(page.getByTestId('years-of-experience')).toHaveText(pattern);
    });

    test('the hero photo has localized alt text and explicit dimensions', async ({
      page,
    }) => {
      await page.goto(path);

      const photo = page.locator('main img');
      await expect(photo).toHaveCount(1);

      const alt = await photo.getAttribute('alt');
      expect(alt).toContain('Carlos Rodríguez Huerta');
      expect(alt).toMatch(lang === 'en' ? /^Portrait of/ : /^Retrato de/);

      const width = Number(await photo.getAttribute('width'));
      const height = Number(await photo.getAttribute('height'));
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });

    for (const viewportWidth of [1280, 390]) {
      test(`the hero photo renders as a square at ${viewportWidth}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewportWidth, height: 900 });
        await page.goto(path);

        const box = await page.locator('main img').boundingBox();
        if (!box) {
          throw new Error('Expected the hero photo to have a layout box.');
        }

        expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
      });
    }

    test('renders the whatsapp, email, linkedin and github calls to action', async ({
      page,
    }) => {
      await page.goto(path);

      const main = page.locator('main');
      await expect(
        main.locator('a[href="https://wa.me/51970791041"]'),
      ).toHaveCount(1);
      await expect(
        main.locator('a[href="mailto:carlos15erh@gmail.com"]'),
      ).toHaveCount(1);
      await expect(
        main.locator(
          'a[href="https://www.linkedin.com/in/carlos-rodriguez-huerta-362ab716a/"]',
        ),
      ).toHaveCount(1);
      await expect(
        main.locator('a[href="https://github.com/crehds"]'),
      ).toHaveCount(1);
    });

    test('does not render a CV link while the profile cv field is unset', async ({
      page,
    }) => {
      await page.goto(path);

      await expect(
        page.locator('main').getByRole('link', { name: /cv/i }),
      ).toHaveCount(0);
    });

    test('renders exactly the 3 featured projects, with no drafts', async ({
      page,
    }) => {
      await page.goto(path);

      const heading = page.getByRole('heading', {
        level: 2,
        name: lang === 'en' ? 'Featured projects' : 'Proyectos destacados',
      });
      await expect(heading).toHaveCount(1);

      const section = page.locator('section').filter({ has: heading });
      const cardHeadings = section.getByRole('heading', { level: 3 });

      // `featuredProjects` sorts by date descending, then by slug ascending as a
      // deterministic tie-break for projects sharing the same date (see
      // src/modules/projects/domain/featured-projects.ts): "expresion-latina" and
      // "pysa" both date 2026-09-28 (expresion-latina sorts first, alphabetically),
      // and "game-with-keyboard" (2026-09-26) is strictly older, so it is always
      // last. The slug tie-break is locale-independent, so this exact order holds in
      // both locales.
      await expect(cardHeadings).toHaveText(
        lang === 'en'
          ? ['Expresión Latina', 'Pysa', 'Game With Keyboard']
          : ['Expresión Latina', 'Pysa Gaming', 'Juego con Teclado'],
      );
    });

    test('each featured project card links to its live site and repository', async ({
      page,
    }) => {
      await page.goto(path);

      const heading = page.getByRole('heading', {
        level: 2,
        name: lang === 'en' ? 'Featured projects' : 'Proyectos destacados',
      });
      const section = page.locator('section').filter({ has: heading });

      await expect(
        section.locator('a[href="https://game-with-keyboard.vercel.app/"]'),
      ).toHaveCount(1);
      await expect(
        section.locator('a[href="https://github.com/crehds/gameWithKeyboard"]'),
      ).toHaveCount(1);
      await expect(
        section.locator('a[href="https://pysa.vercel.app"]'),
      ).toHaveCount(1);
      await expect(
        section.locator('a[href="https://github.com/crehds/pysa"]'),
      ).toHaveCount(1);
    });

    test('renders the latest 3 experience entries in order', async ({
      page,
    }) => {
      await page.goto(path);

      const heading = page.getByRole('heading', {
        level: 2,
        name: lang === 'en' ? 'Experience' : 'Experiencia',
      });
      await expect(heading).toHaveCount(1);

      const section = page.locator('section').filter({ has: heading });
      const entryHeadings = section.getByRole('heading', { level: 3 });

      // Deterministic: no ties among the top 3 by `sortExperience`'s rules
      // (current-first, then end desc, then start desc) - see
      // src/modules/experience/domain/sort-experience.ts and experience.yaml.
      await expect(entryHeadings).toHaveText([
        'FullStack Labs',
        'TechyWe',
        'Freelance',
      ]);
    });
  });
}
