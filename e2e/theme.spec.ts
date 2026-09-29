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

  test('follows a live OS theme change while nothing is stored', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.emulateMedia({ colorScheme: 'dark' });

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const toggle = page.getByRole('button', { name: /theme/i });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('a stored choice keeps applying after a later live OS theme change', async ({
    page,
  }) => {
    // The stored choice and the OS start equal (both "dark") and only the OS then moves
    // away from it. Deriving the stored value from a toggle click would make it the
    // opposite of whatever the OS already is, so the single OS flip this test needs would
    // always land back on the stored value - unable to tell "ignored" from "incorrectly
    // followed". Setting `localStorage` directly avoids that.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // `emulateMedia` can resolve before the page has actually dispatched and finished
    // handling the resulting `change` event, so reading `data-theme` right away would race
    // it - passing either way regardless of whether the (later-registered) production
    // listener reacted correctly. Register our own `change` listener on the same
    // MediaQueryList first: listeners run in registration order, so by the time this one
    // sees the event, the head script's own listener (registered at page load) has already
    // run.
    await page.evaluate(() => {
      const probeWindow = window as Window & { __mediaChanged?: Promise<void> };
      probeWindow.__mediaChanged = new Promise((resolve) => {
        window
          .matchMedia('(prefers-color-scheme: dark)')
          .addEventListener('change', () => resolve(), { once: true });
      });
    });

    await page.emulateMedia({ colorScheme: 'light' });
    await page.evaluate(
      () =>
        (window as Window & { __mediaChanged?: Promise<void> }).__mediaChanged,
    );

    // A plain, non-retrying read, now that the change has definitely been handled.
    const themeAfterOSChange = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    const pressedAfterOSChange = await page.evaluate(() =>
      document.getElementById('theme-toggle')?.getAttribute('aria-pressed'),
    );

    expect(themeAfterOSChange).toBe('dark');
    expect(pressedAfterOSChange).toBe('true');
  });

  test('falls back to the OS theme when the stored value is unrecognized', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('theme', 'system'));

    await page.reload();

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
