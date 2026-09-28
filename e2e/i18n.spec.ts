import { test, expect } from '@playwright/test';

test.describe('language switcher', () => {
  test('moves from the english home to the spanish home and back', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByRole('link', { name: 'Español' }).click();
    expect(new URL(page.url()).pathname).toBe('/es/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    await page.getByRole('link', { name: 'English' }).click();
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
