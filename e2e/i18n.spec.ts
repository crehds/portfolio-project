import { expect } from '@playwright/test';
import { test } from './support/csp-guard';

const switcherStates: {
  path: string;
  label: string;
  current: string;
  other: { name: string; locale: string; href: string };
}[] = [
  {
    path: '/',
    label: 'Language switcher',
    current: 'English',
    other: { name: 'Español', locale: 'es', href: '/es/' },
  },
  {
    path: '/es/',
    label: 'Selector de idioma',
    current: 'Español',
    other: { name: 'English', locale: 'en', href: '/' },
  },
];

test.describe('language switcher', () => {
  test('moves from the english home to the spanish home and back', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // A click only guarantees that navigation started, so wait for the new URL with the
    // retrying assertion instead of reading page.url() once.
    await page.getByRole('link', { name: 'Español' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/es/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    await page.getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  for (const { path, label, current, other } of switcherStates) {
    test(`marks ${current} as current on ${path} without linking to it`, async ({
      page,
    }) => {
      await page.goto(path);
      const switcher = page.getByRole('navigation', { name: label });

      await expect(switcher.getByRole('link', { name: current })).toHaveCount(
        0,
      );
      await expect(switcher.locator('[aria-current="true"]')).toHaveText(
        current,
      );

      const otherLink = switcher.getByRole('link', { name: other.name });
      await expect(otherLink).toHaveAttribute('href', other.href);
      await expect(otherLink).toHaveAttribute('hreflang', other.locale);
      await expect(otherLink).toHaveAttribute('lang', other.locale);
    });
  }
});
