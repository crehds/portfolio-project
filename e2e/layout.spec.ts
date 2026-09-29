import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES: { path: string; lang: string }[] = [
  { path: '/', lang: 'en' },
  { path: '/es/', lang: 'es' },
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
