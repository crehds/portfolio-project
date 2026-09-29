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

  test('a stored choice is applied before first paint, not merely eventually (no flash)', async ({
    page,
  }) => {
    // `toHaveAttribute` retries until it passes, so it would also pass if the theme were
    // applied after first paint (a real flash). Instead, record `data-theme` exactly once,
    // at `DOMContentLoaded` - reliably before first paint, and strictly before a deferred
    // (e.g. `setTimeout`-wrapped) bootstrap scheduled during parsing could still run, since
    // that event fires synchronously as parsing finishes, before any queued timer - via an
    // init script that runs before any of the page's own scripts. Then assert that one
    // recorded value with a plain, non-retrying `toBe`.
    await page.addInitScript(() => {
      const probeWindow = window as Window & {
        __themeAtDomContentLoaded?: string | null;
      };
      probeWindow.__themeAtDomContentLoaded = undefined;

      document.addEventListener(
        'DOMContentLoaded',
        () => {
          probeWindow.__themeAtDomContentLoaded =
            document.documentElement.getAttribute('data-theme');
        },
        { once: true },
      );
    });

    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));

    await page.reload();

    const themeAtDomContentLoaded = await page.evaluate(
      () =>
        (window as Window & { __themeAtDomContentLoaded?: string | null })
          .__themeAtDomContentLoaded,
    );

    expect(themeAtDomContentLoaded).toBe('dark');
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
