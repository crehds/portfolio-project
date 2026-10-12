import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { SITE_URL } from '../src/shared/i18n/locales';
import { COPY, type ContactCopy } from './support/contact-copy';
import { expect, test, useWidgetToken } from './support/contact-test';
import { emailjsFailure, turnstileToken } from './support/fake-upstreams';
import { waitForRateLimitWindow } from './support/rate-limit-window';

// Every state of the contact page, in both locales and both themes, checked by axe against
// WCAG 2.1 A and AA, plus what axe cannot judge: the focus ring and the layout at the widths
// the site supports. The states are reached the way a visitor reaches them, through the real
// Worker and the fake providers.

async function analyze(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations;
}

async function fillAndSend(page: Page, L: ContactCopy, message: string) {
  await page.getByLabel(L.name).fill('Ada Lovelace');
  await page.getByLabel(L.email).fill('ada@example.com');
  await page.getByLabel(L.message).fill(message);
  await page.getByRole('button', { name: L.submit }).click();
}

interface World {
  page: Page;
  L: ContactCopy;
  marker: string;
  submit: (options?: {
    fields?: Record<string, string | undefined>;
  }) => Promise<unknown>;
}

const states: {
  name: string;
  /** Brings the page to the state; returns once it is showing. */
  reach: (world: World) => Promise<void>;
}[] = [
  {
    name: 'the form',
    reach: async ({ page, L }) => {
      await page.goto(L.path);
      await expect(page.getByLabel(L.name)).toBeVisible();
    },
  },
  {
    name: 'a form with an error in each field',
    reach: async ({ page, L }) => {
      await page.goto(L.path);
      await page.getByRole('button', { name: L.submit }).click();
      await expect(page.locator('#contact-error-summary')).toBeVisible();
    },
  },
  {
    name: 'a form with one invalid field, and what was typed',
    reach: async ({ page, L }) => {
      await page.goto(L.path);
      await page.getByLabel(L.name).fill('Ada');
      await page.getByLabel(L.email).fill('not-an-email');
      await page.getByLabel(L.message).fill('A message that stays.');
      await page.getByRole('button', { name: L.submit }).click();
      await expect(page.locator('#contact-email-error')).toBeVisible();
    },
  },
  {
    name: 'the alert for a token that did not verify',
    reach: async ({ page, L, marker }) => {
      await useWidgetToken(page, turnstileToken('refuse', marker));
      await page.goto(L.path);
      await fillAndSend(page, L, `Axe ${marker}`);
      await expect(page.locator('#contact-alert')).toBeVisible();
    },
  },
  {
    name: 'the alert for the rate limit',
    reach: async ({ page, L, marker, submit }) => {
      // Four posts from one address (three here, then the form's) must not straddle a window
      // of the local limiter (see waitForRateLimitWindow). No other state posts more than
      // once, so none of them waits.
      await waitForRateLimitWindow();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await submit();
      }
      await page.goto(L.path);
      await fillAndSend(page, L, `Axe ${marker}`);
      await expect(page.locator('#contact-alert')).toBeVisible();
    },
  },
  {
    name: 'the notice for a verifier that could not answer',
    reach: async ({ page, L, marker }) => {
      await useWidgetToken(page, turnstileToken('fault', marker));
      await page.goto(L.path);
      await fillAndSend(page, L, `Axe ${marker}`);
      await expect(page.locator('#contact-fallback')).toBeVisible();
    },
  },
  {
    name: 'the notice for a message that could not be delivered',
    reach: async ({ page, L, marker }) => {
      await page.goto(L.path);
      await fillAndSend(page, L, `Axe ${marker} ${emailjsFailure(500)}`);
      await expect(page.locator('#contact-fallback')).toBeVisible();
    },
  },
  {
    name: 'the success page',
    reach: async ({ page, L }) => {
      await page.goto(L.sentPath);
      await expect(page.getByRole('status')).toBeVisible();
    },
  },
];

for (const L of COPY) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`axe on the contact page (${L.lang}, ${colorScheme})`, () => {
      for (const state of states) {
        test(`finds no violation in ${state.name}`, async ({
          page,
          marker,
          submit,
        }) => {
          await page.emulateMedia({ colorScheme });

          await state.reach({ page, L, marker, submit });

          expect(await analyze(page)).toEqual([]);
        });
      }
    });
  }
}

for (const L of COPY) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`axe on the page of a visitor without JavaScript (${L.lang}, ${colorScheme})`, () => {
      test('finds no violation in the notice that takes the form’s place', async ({
        page,
      }) => {
        // Axe needs the page's scripts to run, so JavaScript cannot really be off. Keeping
        // `.no-js` on <html> after BaseLayout's script removed it gives the DOM and the CSS of
        // a visitor whose script never ran; contact-nojs.spec.ts covers the real thing.
        await page.addInitScript(() => {
          document.addEventListener('DOMContentLoaded', () => {
            document.documentElement.classList.add('no-js');
          });
        });
        await page.emulateMedia({ colorScheme });
        await page.goto(L.path);
        await expect(page.locator('#contact-nojs')).toBeVisible();
        await expect(page.locator('form')).toBeHidden();

        expect(await analyze(page)).toEqual([]);
      });
    });
  }
}

test.describe('the focus ring', () => {
  test('is visible on every control of the form, reached with the keyboard', async ({
    page,
  }) => {
    await page.goto('/contact/');
    await page.getByLabel('Name').focus();

    const rings: { control: string; style: string; width: string }[] = [];
    for (const control of [
      'Name',
      'Email address',
      'Message',
      'Send message',
    ]) {
      const focused = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement;
        const style = getComputedStyle(element);
        return {
          label:
            element.id ||
            element.textContent?.trim() ||
            element.tagName.toLowerCase(),
          style: style.outlineStyle,
          width: style.outlineWidth,
        };
      });
      rings.push({
        control: `${control} (${focused.label})`,
        style: focused.style,
        width: focused.width,
      });
      await page.keyboard.press('Tab');
    }

    expect(rings).toHaveLength(4);
    for (const ring of rings) {
      expect(ring.style, ring.control).toBe('solid');
      expect(parseFloat(ring.width), ring.control).toBeGreaterThanOrEqual(2);
    }
  });

  test('is visible on the links of an error summary', async ({ page }) => {
    await page.goto('/contact/');
    await page.getByRole('button', { name: 'Send message' }).click();

    await page
      .locator('#contact-error-summary')
      .getByRole('link')
      .first()
      .focus();

    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as HTMLElement);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(ring.style).toBe('solid');
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2);
  });
});

test.describe('layout', () => {
  const widths = [320, 390, 768, 1280];

  for (const width of widths) {
    test(`nothing overflows sideways at ${width}px, in any state`, async ({
      page,
      marker,
    }) => {
      await page.setViewportSize({ width, height: 900 });

      const overflowing = async (label: string) => {
        const overflow = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        expect(overflow.scroll, label).toBeLessThanOrEqual(overflow.client);
      };

      for (const L of COPY) {
        await page.goto(L.path);
        await overflowing(`the form (${L.lang})`);

        await page.getByRole('button', { name: L.submit }).click();
        await expect(page.locator('#contact-error-summary')).toBeVisible();
        await overflowing(`field errors (${L.lang})`);

        await page.goto(L.sentPath);
        await overflowing(`the success page (${L.lang})`);
      }

      await useWidgetToken(page, turnstileToken('fault', marker));
      await page.goto('/contact/');
      await fillAndSend(
        page,
        COPY[0],
        `Layout ${marker} with a rather long text `.repeat(20),
      );
      await expect(page.locator('#contact-fallback')).toBeVisible();
      await overflowing('the notice with a long message');
    });
  }

  test('keeps every field and the button inside the viewport at 320px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/contact/');

    for (const name of ['Name', 'Email address', 'Message']) {
      const box = await page.getByLabel(name).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.x, name).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, name).toBeLessThanOrEqual(320);
    }
    const button = await page
      .getByRole('button', { name: 'Send message' })
      .boundingBox();
    expect(button!.x + button!.width).toBeLessThanOrEqual(320);
  });
});

test.describe('the pages that answer a post', () => {
  for (const L of COPY) {
    test(`point the canonical link, the alternates and the language switcher at the clean pages, not at the Action (${L.lang})`, async ({
      page,
    }) => {
      await page.goto(L.path);
      await page.getByRole('button', { name: L.submit }).click();
      await expect(page.locator('#contact-error-summary')).toBeVisible();
      expect(new URL(page.url()).search).toBe('?_action=contact');

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${SITE_URL}${L.path}`,
      );
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]'),
      ).toHaveAttribute('href', `${SITE_URL}/contact/`);
      await expect(
        page.locator('link[rel="alternate"][hreflang="es"]'),
      ).toHaveAttribute('href', `${SITE_URL}/es/contact/`);
      const otherLocale = L.lang === 'en' ? 'es' : 'en';
      await expect(
        page.locator(`nav a[hreflang="${otherLocale}"]`),
      ).toHaveAttribute(
        'href',
        otherLocale === 'es' ? '/es/contact/' : '/contact/',
      );
    });

    test(`keep the Contact nav item current (${L.lang})`, async ({ page }) => {
      await page.goto(L.path);
      await page.getByRole('button', { name: L.submit }).click();
      await expect(page.locator('#contact-error-summary')).toBeVisible();

      await expect(
        page.locator('nav [aria-current="page"]').first(),
      ).toHaveText(L.lang === 'en' ? 'Contact' : 'Contacto');
    });
  }
});
