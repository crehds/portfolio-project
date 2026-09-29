import { test, expect } from '@playwright/test';

test.describe('theme', () => {
  test('loads dark when the OS prefers dark and nothing is stored', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('loads light when the OS prefers light and nothing is stored', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('the toggle switches the theme, and the choice survives a reload', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const toggle = page.getByRole('button', { name: /theme/i });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('a stored choice is already applied at DOMContentLoaded (no flash)', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));

    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('without JS, the toggle is not shown and the OS theme still applies via CSS', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      colorScheme: 'dark',
    });
    const page = await context.newPage();

    await page.goto('/');

    await expect(page.locator('#theme-toggle')).toBeHidden();
    const backgroundColor = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(backgroundColor).toBe('rgb(22, 26, 23)');

    await context.close();
  });
});
