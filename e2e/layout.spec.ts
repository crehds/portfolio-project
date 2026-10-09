import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES: { path: string; lang: string }[] = [
  { path: '/', lang: 'en' },
  { path: '/es/', lang: 'es' },
];

// An address with no page behind it gets the error page of its locale (see
// not-found.spec.ts). It shares the header, so it has to fit the screen like any page.
const NOT_FOUND_PAGES: { path: string; lang: string }[] = [
  { path: '/no-such-page', lang: 'en' },
  { path: '/es/no-such-page', lang: 'es' },
];

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations;
}

test.describe('base layout landmarks', () => {
  for (const { path, lang } of PAGES) {
    test(`has exactly one banner, main and contentinfo landmark (${lang})`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('contentinfo')).toHaveCount(1);
    });

    test(`every navigation landmark has an accessible name (${lang})`, async ({
      page,
    }) => {
      await page.goto(path);

      const navs = page.getByRole('navigation');
      const count = await navs.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const name = await navs.nth(i).getAttribute('aria-label');
        expect(name?.trim()).toBeTruthy();
      }
    });

    test(`the primary nav marks the current page with aria-current (${lang})`, async ({
      page,
    }) => {
      await page.goto(path);

      const primaryNav = page.getByRole('navigation', {
        name: lang === 'en' ? 'Primary navigation' : 'Navegación principal',
      });
      await expect(primaryNav.locator('[aria-current="page"]')).toHaveCount(1);
    });

    test(`footer links come from the profile content collection (${lang})`, async ({
      page,
    }) => {
      await page.goto(path);

      const footer = page.getByRole('contentinfo');
      await expect(
        footer.locator('a[href="https://github.com/crehds"]'),
      ).toHaveCount(1);
      await expect(
        footer.locator(
          'a[href="https://www.linkedin.com/in/carlos-rodriguez-huerta-362ab716a/"]',
        ),
      ).toHaveCount(1);
      await expect(
        footer.locator('a[href="mailto:carlos15erh@gmail.com"]'),
      ).toHaveCount(1);
      await expect(footer.getByText('Carlos Rodríguez Huerta')).toHaveCount(1);
    });
  }

  test('the skip link is the first Tab stop and moves focus to main', async ({
    page,
  }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    for (const { path, lang } of PAGES) {
      test(`has no detectable accessibility violations (${lang}, ${colorScheme})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);

        expect(await axeViolations(page)).toEqual([]);
      });
    }
  }
});

test.describe('layout alignment', () => {
  test('the main column aligns with the header and footer content at 1280px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // The header and footer's own content wrapper (the sole direct child `div`), not the
    // full-bleed `<header>`/`<footer>` element itself, since that's what carries the shared
    // max-width and padding that `<main>` must line up with.
    const headerContent = page.getByRole('banner').locator(':scope > div');
    const main = page.getByRole('main');
    const footerContent = page.getByRole('contentinfo').locator(':scope > div');

    const [headerBox, mainBox, footerBox] = await Promise.all([
      headerContent.boundingBox(),
      main.boundingBox(),
      footerContent.boundingBox(),
    ]);

    if (!headerBox || !mainBox || !footerBox) {
      throw new Error(
        'Expected the header, main and footer content to each have a layout box.',
      );
    }

    expect(Math.abs(mainBox.x - headerBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(mainBox.x - footerBox.x)).toBeLessThanOrEqual(1);
  });

  test('the page heading has vertical space before the following text', async ({
    page,
  }) => {
    await page.goto('/');

    const heading = page.getByRole('heading', { level: 1 });
    const paragraph = page.locator('main p').first();

    const [headingBox, paragraphBox] = await Promise.all([
      heading.boundingBox(),
      paragraph.boundingBox(),
    ]);

    if (!headingBox || !paragraphBox) {
      throw new Error(
        'Expected the heading and the following paragraph to each have a layout box.',
      );
    }

    expect(paragraphBox.y - (headingBox.y + headingBox.height)).toBeGreaterThan(
      0,
    );
  });

  test('nothing overflows horizontally at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const hasHorizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

    expect(hasHorizontalOverflow).toBe(false);
  });

  // The header holds the site name, the primary navigation and the language and theme
  // controls. The navigation is the widest part, and the Spanish labels are longer than the
  // English ones ("Experiencia", "Habilidades", "Contacto"), so it must wrap instead of
  // pushing the page wider than the screen. 320px is the narrowest width the site supports.
  for (const width of [320, 390, 768]) {
    for (const { path, lang } of [...PAGES, ...NOT_FOUND_PAGES]) {
      test(`the header does not overflow the page at ${width}px (${lang}, ${path})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(path);

        const overflow = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

        // Every navigation item is inside the screen too, not just the page's scroll width.
        const nav = page.getByRole('navigation', {
          name: lang === 'en' ? 'Primary navigation' : 'Navegación principal',
        });
        for (const link of await nav.getByRole('link').all()) {
          const box = await link.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
      });
    }
  }
});

async function computedMarkerStyle(link: Locator) {
  return link.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      color: style.color,
      borderBottomColor: style.borderBottomColor,
      borderBottomWidth: style.borderBottomWidth,
    };
  });
}

test.describe('current-page nav marker', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the current nav item's computed style differs from a non-current item's (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      // On `/projects/`, "Projects" is the current page and "Home" is not - see
      // `NAV_ITEMS`/`BaseLayout.astro`. Both `aria-current="page"` (this page) and
      // `aria-current="true"` (a nested section, e.g. a project detail page - see
      // projects-detail.spec.ts) share the same conditional styling, so checking one
      // value exercises that shared code path.
      await page.goto('/projects/');

      const nav = page.getByRole('navigation', { name: 'Primary navigation' });
      const current = nav.getByRole('link', { name: 'Projects' });
      const notCurrent = nav.getByRole('link', { name: 'Home' });

      await expect(current).toHaveAttribute('aria-current', 'page');
      await expect(notCurrent).not.toHaveAttribute('aria-current');

      const [currentStyle, notCurrentStyle] = await Promise.all([
        computedMarkerStyle(current),
        computedMarkerStyle(notCurrent),
      ]);

      expect(currentStyle).not.toEqual(notCurrentStyle);
    });
  }
});
