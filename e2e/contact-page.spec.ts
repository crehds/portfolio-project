import { existsSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SITE = 'https://portfolio-project.carlos15erh.workers.dev';
const DIST_CLIENT = new URL('../dist/client/', import.meta.url);

// The contact page and its locale twin. Both are on demand (the form posts to the page), so
// everything here is about the page itself: structure, navigation and i18n. The form and
// what it does are in contact-form.spec.ts.
const pages = [
  {
    path: '/contact/',
    otherPath: '/es/contact/',
    lang: 'en',
    otherName: 'Español',
    title: 'Contact — Carlos Rodríguez Huerta',
    heading: 'Contact',
    navLabel: 'Contact',
    primaryNavLabel: 'Primary navigation',
    switcherLabel: 'Language switcher',
    otherWaysHeading: 'Other ways to reach me',
    emailLabel: 'Email',
    whatsappLabel: 'WhatsApp',
  },
  {
    path: '/es/contact/',
    otherPath: '/contact/',
    lang: 'es',
    otherName: 'English',
    title: 'Contacto — Carlos Rodríguez Huerta',
    heading: 'Contacto',
    navLabel: 'Contacto',
    primaryNavLabel: 'Navegación principal',
    switcherLabel: 'Selector de idioma',
    otherWaysHeading: 'Otras formas de contactarme',
    emailLabel: 'Correo electrónico',
    whatsappLabel: 'WhatsApp',
  },
];

for (const {
  path,
  otherPath,
  lang,
  otherName,
  title,
  heading,
  navLabel,
  primaryNavLabel,
  switcherLabel,
  otherWaysHeading,
  emailLabel,
  whatsappLabel,
} of pages) {
  test.describe(`contact page (${lang})`, () => {
    test('is served with its own language, one h1 and a title', async ({
      page,
    }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page).toHaveTitle(title);
    });

    test('marks the Contact nav item as the current page, as the last item', async ({
      page,
    }) => {
      await page.goto(path);

      const nav = page.getByRole('navigation', { name: primaryNavLabel });
      const current = nav.getByRole('link', { name: navLabel });

      await expect(current).toHaveAttribute('aria-current', 'page');
      await expect(nav.getByRole('link').last()).toHaveText(navLabel);
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    });

    test('declares the hreflang alternates on the site origin', async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page.locator('link[rel="alternate"]')).toHaveCount(3);
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]'),
      ).toHaveAttribute('href', `${SITE}/contact/`);
      await expect(
        page.locator('link[rel="alternate"][hreflang="es"]'),
      ).toHaveAttribute('href', `${SITE}/es/contact/`);
      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]'),
      ).toHaveAttribute('href', `${SITE}/contact/`);
    });

    test("the language switcher leads to the other locale's contact page", async ({
      page,
    }) => {
      await page.goto(path);

      const switcher = page.getByRole('navigation', { name: switcherLabel });
      await expect(
        switcher.getByRole('link', { name: otherName }),
      ).toHaveAttribute('href', otherPath);

      await switcher.getByRole('link', { name: otherName }).click();
      await expect(page).toHaveURL((url) => url.pathname === otherPath);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('offers email and WhatsApp as direct ways to write', async ({
      page,
    }) => {
      await page.goto(path);

      const section = page.locator('section').filter({
        has: page.getByRole('heading', {
          level: 2,
          name: otherWaysHeading,
        }),
      });
      await expect(section).toHaveCount(1);

      const email = section.getByRole('link', { name: emailLabel });
      await expect(email).toHaveAttribute(
        'href',
        'mailto:carlos15erh@gmail.com',
      );
      // A mail client opens in its own window: no new tab for it.
      await expect(email).not.toHaveAttribute('target');

      const whatsapp = section.getByRole('link', { name: whatsappLabel });
      await expect(whatsapp).toHaveAttribute(
        'href',
        'https://wa.me/51970791041',
      );
      await expect(whatsapp).toHaveAttribute('target', '_blank');
    });

    for (const colorScheme of ['light', 'dark'] as const) {
      test(`has no detectable accessibility violations (${colorScheme})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        expect(results.violations).toEqual([]);
      });
    }
  });
}

test.describe('what is on demand', () => {
  // The form posts to the page, so the contact pages must run on the Worker; every other
  // page stays a static file. A page that lost `prerender = false` would be built as a
  // file and answer a POST with an error.
  test('the build has no static contact page, and every other page is static', () => {
    expect(existsSync(new URL('contact/index.html', DIST_CLIENT))).toBe(false);
    expect(existsSync(new URL('es/contact/index.html', DIST_CLIENT))).toBe(
      false,
    );

    for (const staticPage of [
      'index.html',
      'es/index.html',
      'projects/index.html',
      'experience/index.html',
      'skills/index.html',
      'es/skills/index.html',
    ]) {
      expect(
        existsSync(new URL(staticPage, DIST_CLIENT)),
        `dist/client/${staticPage}`,
      ).toBe(true);
    }
  });
});
