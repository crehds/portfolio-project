import { COPY } from './support/contact-copy';
import { expect, test } from './support/contact-test';

// Turnstile has no way to work without JavaScript, so a form that could be filled in would
// only be a way to send nothing. A visitor without it gets email and WhatsApp instead, and
// the server still refuses whatever someone posts without the form. See the rules under
// `.no-js` in src/styles/global.css (unlayered) and src/styles/no-js.test.ts.

const NOTICE = {
  en: 'The form needs JavaScript',
  es: 'El formulario necesita JavaScript',
};

test.describe('a visitor without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const L of COPY) {
    test(`sees a notice with email and WhatsApp in place of the form (${L.lang})`, async ({
      page,
    }) => {
      await page.goto(L.path);

      await expect(page.locator('html')).toHaveClass(/\bno-js\b/);

      const notice = page.locator('#contact-nojs');
      await expect(notice).toBeVisible();
      await expect(
        notice.getByRole('heading', { name: NOTICE[L.lang] }),
      ).toBeVisible();
      await expect(
        notice.getByRole('link', { name: L.emailLink }),
      ).toHaveAttribute('href', 'mailto:carlos15erh@gmail.com');
      await expect(
        notice.getByRole('link', { name: L.whatsappLink }),
      ).toHaveAttribute('href', 'https://wa.me/51970791041');
    });

    test(`does not show the form, its lead or a second list of the same links (${L.lang})`, async ({
      page,
    }) => {
      await page.goto(L.path);

      await expect(page.locator('form')).toBeHidden();
      await expect(page.getByLabel(L.name)).toBeHidden();
      await expect(page.getByLabel(L.message)).toBeHidden();
      await expect(page.getByRole('button', { name: L.submit })).toBeHidden();
      await expect(page.locator('#contact-other-ways')).toBeHidden();
      // The one list of ways to write is the notice's.
      await expect(page.locator('main a[href^="mailto:"]:visible')).toHaveCount(
        1,
      );
      await expect(
        page.locator('main a[href^="https://wa.me/"]:visible'),
      ).toHaveCount(1);
    });
  }

  test('still has the rest of the page: the heading, the navigation and the footer', async ({
    page,
  }) => {
    await page.goto('/contact/');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact');
    await expect(page.getByRole('navigation').first()).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('is not an excuse to skip the checks: the server refuses what is posted without the form', async ({
    submit,
    marker,
    upstream,
  }) => {
    const invalid = await submit({
      fields: { name: `Ada ${marker}`, email: 'nope' },
    });
    const tokenless = await submit({
      fields: { 'cf-turnstile-response': undefined },
    });

    expect(invalid.status()).toBe(400);
    expect(tokenless.status()).toBe(400);
    expect(await tokenless.text()).toContain('id="contact-alert"');
    expect(await upstream.callsFor(marker)).toEqual([]);
  });
});

test.describe('a visitor with JavaScript', () => {
  for (const L of COPY) {
    test(`sees the form and none of the notice for the one without (${L.lang})`, async ({
      page,
    }) => {
      await page.goto(L.path);

      await expect(page.locator('html')).not.toHaveClass(/\bno-js\b/);
      await expect(page.locator('#contact-nojs')).toBeHidden();
      await expect(page.getByLabel(L.name)).toBeVisible();
      await expect(page.getByRole('button', { name: L.submit })).toBeVisible();
      await expect(page.locator('#contact-other-ways')).toBeVisible();
    });
  }

  test('sees the notice for the one without JavaScript only while the page cannot know', async ({
    page,
  }) => {
    // Hold back the stylesheet's own signal: nothing here removes `.no-js`, so the page
    // behaves as it does for a visitor whose script never ran (blocked, failed).
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.classList.add('no-js');
      });
    });
    await page.goto('/contact/');

    await expect(page.locator('#contact-nojs')).toBeVisible();
    await expect(page.locator('form')).toBeHidden();
  });
});
