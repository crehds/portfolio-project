import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('home page', () => {
  test('has the expected landmarks and metadata', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page).toHaveTitle(/.+/);
  });

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
