import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SITE = 'https://portfolio-project.carlos15erh.workers.dev';

const homePages: { path: string; lang: string }[] = [
  { path: '/', lang: 'en' },
  { path: '/es/', lang: 'es' },
];

for (const { path, lang } of homePages) {
  test.describe(`home page (${lang})`, () => {
    // `featuredProjects` sorts by date descending, then by slug ascending as a
    // deterministic tie-break for projects sharing the same date (see
    // src/modules/projects/domain/featured-projects.ts): "expresion-latina" and
    // "pysa" both date 2026-09-28 (expresion-latina sorts first, alphabetically),
    // and "game-with-keyboard" (2026-09-26) is strictly older, so it is always
    // last. The slug tie-break is locale-independent, so this exact order holds in
    // both locales. Shared by every featured-card test below, so a card that stops
    // rendering (or renders out of order) fails loudly instead of an "at least one
    // card" check silently passing with fewer cards checked.
    const expectedFeaturedTitles =
      lang === 'en'
        ? ['Expresión Latina', 'Pysa', 'Game With Keyboard']
        : ['Expresión Latina', 'Pysa Gaming', 'Juego con Teclado'];

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

      await expect(cardHeadings).toHaveText(expectedFeaturedTitles);
    });

    test('every featured project card title links to its own project page', async ({
      page,
    }) => {
      await page.goto(path);

      const heading = page.getByRole('heading', {
        level: 2,
        name: lang === 'en' ? 'Featured projects' : 'Proyectos destacados',
      });
      const section = page.locator('section').filter({ has: heading });
      const cardHeadings = section.getByRole('heading', { level: 3 });

      // Keyed by heading text, like the link-coverage test below: every rendered card's
      // title must link to its own project page, not just the first one.
      const expectedHrefByHeading: Record<string, string> =
        lang === 'en'
          ? {
              'Expresión Latina': '/projects/expresion-latina/',
              Pysa: '/projects/pysa/',
              'Game With Keyboard': '/projects/game-with-keyboard/',
            }
          : {
              'Expresión Latina': '/es/projects/expresion-latina/',
              'Pysa Gaming': '/es/projects/pysa/',
              'Juego con Teclado': '/es/projects/game-with-keyboard/',
            };

      // Exact count and order, not "at least one card": a featured card that stops
      // rendering must fail this test instead of silently passing with fewer cards
      // checked.
      await expect(cardHeadings).toHaveText(expectedFeaturedTitles);

      for (let i = 0; i < expectedFeaturedTitles.length; i++) {
        const cardHeading = cardHeadings.nth(i);
        const text = await cardHeading.innerText();
        const expectedHref = expectedHrefByHeading[text];
        if (!expectedHref) {
          throw new Error(`No expected project href recorded for "${text}".`);
        }

        await expect(cardHeading.getByRole('link')).toHaveAttribute(
          'href',
          expectedHref,
        );
      }
    });

    test('every featured project card links to its live site and repository', async ({
      page,
    }) => {
      await page.goto(path);

      const heading = page.getByRole('heading', {
        level: 2,
        name: lang === 'en' ? 'Featured projects' : 'Proyectos destacados',
      });
      const section = page.locator('section').filter({ has: heading });
      // A direct-child selector, not `getByRole('listitem')`: Chromium drops the
      // implicit list/listitem role from a `<ul>`/`<li>` pair once the `<ul>` gets a
      // non-list `display` (here Tailwind's `grid`), so an ARIA-role locator would
      // silently match zero cards instead of the 3 rendered ones.
      const cards = section
        .getByTestId('featured-projects-grid')
        .locator(':scope > li');

      // Keyed by each card's own heading text (localized), so every rendered card is
      // checked - not just however many the test happens to name explicitly. A card
      // whose heading is missing from this map fails loudly below instead of the test
      // silently skipping it, which is how this test previously checked only 2 of the
      // 3 rendered cards (missing "Expresión Latina").
      const expectedLinksByHeading: Record<
        string,
        { live: string; repo: string }
      > = {
        'Expresión Latina': {
          live: 'https://expresion-latina.vercel.app/',
          repo: 'https://github.com/crehds/expresion-latina',
        },
        Pysa: {
          live: 'https://pysa.vercel.app',
          repo: 'https://github.com/crehds/pysa',
        },
        'Pysa Gaming': {
          live: 'https://pysa.vercel.app',
          repo: 'https://github.com/crehds/pysa',
        },
        'Game With Keyboard': {
          live: 'https://game-with-keyboard.vercel.app/',
          repo: 'https://github.com/crehds/gameWithKeyboard',
        },
        'Juego con Teclado': {
          live: 'https://game-with-keyboard.vercel.app/',
          repo: 'https://github.com/crehds/gameWithKeyboard',
        },
      };

      // Exact count and order, not "at least one card": a featured card that stops
      // rendering must fail this test instead of silently passing with fewer cards
      // checked.
      await expect(cards).toHaveCount(expectedFeaturedTitles.length);

      for (let i = 0; i < expectedFeaturedTitles.length; i++) {
        const card = cards.nth(i);
        const cardHeading = await card
          .getByRole('heading', { level: 3 })
          .innerText();
        expect(cardHeading).toBe(expectedFeaturedTitles[i]);

        const expected = expectedLinksByHeading[cardHeading];
        if (!expected) {
          throw new Error(
            `No expected live/repository links recorded for featured card "${cardHeading}".`,
          );
        }

        await expect(card.locator(`a[href="${expected.live}"]`)).toHaveCount(1);
        await expect(card.locator(`a[href="${expected.repo}"]`)).toHaveCount(1);
      }
    });

    test('the featured projects grid spans the full container width at 1280px', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(path);

      // The header's own content wrapper (the sole direct child `div`), not the
      // full-bleed `<header>` itself - matches the pattern layout.spec.ts already
      // uses for the shared container's alignment. That wrapper carries its own
      // `px-4` padding, so its *content*-box right edge (border-box right edge minus
      // its own right padding) is the visible edge to compare against - not its
      // outer/border-box edge, which the grid (nested one level deeper, inside
      // `<main>`'s own padding) was never going to reach.
      const headerContent = page.getByRole('banner').locator(':scope > div');
      const grid = page.getByTestId('featured-projects-grid');

      const [headerBox, headerPaddingRight, gridBox] = await Promise.all([
        headerContent.boundingBox(),
        headerContent.evaluate((el) => getComputedStyle(el).paddingRight),
        grid.boundingBox(),
      ]);
      if (!headerBox || !gridBox) {
        throw new Error(
          'Expected the header content and the featured projects grid to each have a layout box.',
        );
      }

      const headerContentRight =
        headerBox.x + headerBox.width - parseFloat(headerPaddingRight);
      const gridRight = gridBox.x + gridBox.width;
      expect(Math.abs(gridRight - headerContentRight)).toBeLessThanOrEqual(1);
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

    test('the experience summary links to the full experience page', async ({
      page,
    }) => {
      await page.goto(path);

      const heading = page.getByRole('heading', {
        level: 2,
        name: lang === 'en' ? 'Experience' : 'Experiencia',
      });
      const section = page.locator('section').filter({ has: heading });
      const link = section.getByRole('link', {
        name:
          lang === 'en' ? 'See full experience' : 'Ver experiencia completa',
      });

      await expect(link).toHaveAttribute(
        'href',
        lang === 'en' ? '/experience/' : '/es/experience/',
      );
    });
  });
}
