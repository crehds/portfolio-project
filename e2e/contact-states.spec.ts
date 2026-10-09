import type { Page } from '@playwright/test';

import { COPY, type ContactCopy } from './support/contact-copy';
import {
  ACTION_QUERY,
  expect,
  test,
  useWidgetToken,
} from './support/contact-test';
import { emailjsFailure, turnstileToken } from './support/fake-upstreams';
import { waitForRateLimitWindow } from './support/rate-limit-window';

// The ways a submission can fail to go through, and what each leaves behind: the page, its
// status, and what the providers were asked. Each state is rendered in detail, in both
// locales, by src/components/contact/contact-page.test.ts; these tests prove that the real
// Worker reaches it from the real answers (the fake Turnstile and EmailJS), with the HTTP
// status the page promises.

async function fill(
  page: Page,
  L: ContactCopy,
  message: string,
  name = 'Ada Lovelace',
) {
  await page.getByLabel(L.name).fill(name);
  await page.getByLabel(L.email).fill('ada@example.com');
  await page.getByLabel(L.message).fill(message);
}

/** Submits the form and returns the answer of the POST (the page, or the redirect it follows). */
async function submitForm(page: Page, L: ContactCopy) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST'),
    page.getByRole('button', { name: L.submit }).click(),
  ]);
  return response;
}

test.describe('the honeypot', () => {
  test('a bot that fills the hidden field gets the answer a person gets, and nothing is sent', async ({
    page,
    marker,
    upstream,
  }) => {
    const L = COPY[0];
    await page.goto(L.path);
    await fill(page, L, `Bot ${marker}`);
    await page.locator('#contact-website').fill('https://spam.example');
    await page.getByRole('button', { name: L.submit }).click();

    await expect(page).toHaveURL(
      (url) => url.pathname + url.search === L.sentPath,
    );
    await expect(page.getByRole('status')).toContainText(L.sent);
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('answers a filled honeypot exactly as it answers a real message, so a bot cannot tell', async ({
    submit,
    marker,
    upstream,
  }) => {
    const real = await submit();
    const trapped = await submit({
      fields: {
        website: 'https://spam.example',
        message: `Trapped ${marker}`,
      },
    });

    expect(trapped.status()).toBe(real.status());
    expect(trapped.headers()['location']).toBe(real.headers()['location']);
    expect(await trapped.text()).toBe(await real.text());

    // Only the real one reached the providers.
    const calls = await upstream.callsFor(marker);
    expect(calls.filter((call) => call.upstream === 'emailjs')).toHaveLength(1);
  });

  test('treats even a single character, or white space, in the hidden field as a bot', async ({
    submit,
    marker,
    upstream,
  }) => {
    for (const website of ['x', '   ']) {
      const response = await submit({ fields: { website } });
      expect(response.status()).toBe(303);
    }

    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('counts a trapped submission nowhere: it spends none of the rate limit', async ({
    submit,
  }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await submit({ fields: { website: 'bot' } });
      expect(response.status()).toBe(303);
    }

    // The limit is three real submissions a minute; five trapped ones left it untouched.
    expect((await submit()).status()).toBe(303);
  });

  test('is out of sight and out of reach for a person', async ({ page }) => {
    await page.goto('/contact/');

    const wrapper = page.locator('#contact-honeypot');
    await expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#contact-website')).toHaveAttribute(
      'tabindex',
      '-1',
    );
    await expect(page.locator('#contact-website')).toHaveAttribute(
      'autocomplete',
      'off',
    );

    // Far off screen to the left, but still laid out: not `display: none`.
    const box = await wrapper.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThan(0);
    expect(
      await wrapper.evaluate((el) => getComputedStyle(el).display),
    ).not.toBe('none');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  });
});

test.describe('a submission Turnstile does not accept', () => {
  const refusals = [
    ['a token Turnstile refuses', 'refuse' as const, 1],
    ['a token that was already used', 'duplicate' as const, 1],
    ['no token at all (the widget never finished)', null, 0],
  ] as const;

  for (const L of COPY) {
    for (const [label, scenario, turnstileCalls] of refusals) {
      test(`answers ${label} with a 400, an alert that offers email and WhatsApp, and the form with what was typed (${L.lang})`, async ({
        page,
        marker,
        upstream,
      }) => {
        await useWidgetToken(
          page,
          scenario === null ? null : turnstileToken(scenario, marker),
        );
        await page.goto(L.path);
        await fill(page, L, `Try again ${marker}`);

        const response = await submitForm(page, L);

        expect(response.status()).toBe(400);
        await expect(page).toHaveTitle(`${L.errorWord} ${L.title}`);
        const alert = page.locator('#contact-alert');
        await expect(alert).toHaveAttribute('role', 'alert');
        await expect(alert).toContainText(L.alertVerification);
        await expect(
          alert.getByRole('link', { name: L.emailLink }),
        ).toHaveAttribute('href', 'mailto:carlos15erh@gmail.com');
        await expect(
          alert.getByRole('link', { name: L.whatsappLink }),
        ).toHaveAttribute('href', 'https://wa.me/51970791041');

        // The form is still there, with what was typed, to try again.
        await expect(page.getByLabel(L.name)).toHaveValue('Ada Lovelace');
        await expect(page.getByLabel(L.message)).toHaveValue(
          `Try again ${marker}`,
        );

        // Nothing was sent. Turnstile was asked once, unless there was no token to ask about.
        const calls = await upstream.callsFor(marker);
        expect(calls.filter((c) => c.upstream === 'emailjs')).toHaveLength(0);
        expect(calls.filter((c) => c.upstream === 'turnstile')).toHaveLength(
          turnstileCalls,
        );
      });
    }
  }

  test('a post with no token is refused as well, without asking Turnstile', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({
      fields: { 'cf-turnstile-response': undefined },
    });

    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('id="contact-alert"');
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('a post with a blank token is refused as well, without asking Turnstile', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({
      fields: { 'cf-turnstile-response': '   ' },
    });

    expect(response.status()).toBe(400);
    expect(await upstream.callsFor(marker)).toEqual([]);
  });
});

test.describe('a verifier that cannot answer', () => {
  const faults = [
    ['blames our secret key', 'fault' as const],
    ['is down (HTTP 500)', 'http-500' as const],
    ['lists an error code nobody documented', 'unknown-code' as const],
  ] as const;

  for (const L of COPY) {
    for (const [label, scenario] of faults) {
      test(`answers with a 503, and the notice in the form’s place with the message to copy, when Turnstile ${label} (${L.lang})`, async ({
        page,
        marker,
        upstream,
      }) => {
        await useWidgetToken(page, turnstileToken(scenario, marker));
        await page.goto(L.path);
        await fill(page, L, `Please read ${marker}`);

        const response = await submitForm(page, L);

        expect(response.status()).toBe(503);
        await expect(page).toHaveTitle(`${L.errorWord} ${L.title}`);

        const notice = page.locator('#contact-fallback');
        await expect(notice).toHaveAttribute('role', 'alert');
        await expect(
          notice.getByRole('heading', { name: L.fallbackHeading }),
        ).toBeVisible();
        await expect(notice).toContainText(L.fallbackKept);
        await expect(
          notice.getByRole('link', { name: L.emailLink }),
        ).toHaveAttribute('href', 'mailto:carlos15erh@gmail.com');
        await expect(
          notice.getByRole('link', { name: L.whatsappLink }),
        ).toHaveAttribute('href', 'https://wa.me/51970791041');

        // The message to copy, in a labelled text area nobody can change by accident.
        const copy = notice.getByLabel(L.fallbackMessageLabel);
        await expect(copy).toHaveValue(`Please read ${marker}`);
        await expect(copy).toHaveAttribute('readonly', '');

        // The form is gone, and so is Turnstile's script: there is nothing to verify.
        await expect(page.getByLabel(L.name)).toHaveCount(0);
        await expect(page.locator('form')).toHaveCount(0);
        await expect(
          page.locator('script[src*="challenges.cloudflare.com"]'),
        ).toHaveCount(0);

        const calls = await upstream.callsFor(marker);
        expect(calls.filter((c) => c.upstream === 'emailjs')).toHaveLength(0);
        expect(calls.filter((c) => c.upstream === 'turnstile')).toHaveLength(1);
      });
    }
  }

  test('is told apart from a refused token: the visitor is not asked to try again', async ({
    submit,
    marker,
  }) => {
    const refused = await submit({
      fields: { 'cf-turnstile-response': turnstileToken('refuse', marker) },
    });
    const down = await submit({
      fields: { 'cf-turnstile-response': turnstileToken('fault', marker) },
    });

    expect(refused.status()).toBe(400);
    expect(await refused.text()).toContain('id="contact-alert"');
    expect(down.status()).toBe(503);
    const html = await down.text();
    expect(html).toContain('id="contact-fallback"');
    expect(html).not.toContain('id="contact-alert"');
  });
});

test.describe('a message EmailJS does not take', () => {
  for (const L of COPY) {
    for (const status of [500, 429, 403]) {
      test(`answers with a 502 and the notice with the message to copy when EmailJS answers ${status} (${L.lang})`, async ({
        page,
        marker,
        upstream,
      }) => {
        const text = `Do not lose me ${marker} ${emailjsFailure(status)}`;
        await page.goto(L.path);
        await fill(page, L, text);

        const response = await submitForm(page, L);

        expect(response.status()).toBe(502);
        await expect(page).toHaveTitle(`${L.errorWord} ${L.title}`);
        const notice = page.locator('#contact-fallback');
        await expect(
          notice.getByRole('heading', { name: L.fallbackHeading }),
        ).toBeVisible();
        await expect(notice.getByLabel(L.fallbackMessageLabel)).toHaveValue(
          text,
        );
        await expect(page.locator('form')).toHaveCount(0);

        // EmailJS was asked once and not again: one request a failed message costs at most.
        const calls = await upstream.callsFor(marker);
        expect(calls.filter((c) => c.upstream === 'turnstile')).toHaveLength(1);
        expect(calls.filter((c) => c.upstream === 'emailjs')).toHaveLength(1);
      });
    }
  }
});

test.describe('the rate limit', () => {
  // The local limiter counts in fixed windows on the wall clock, so a burst of four posts must
  // not straddle a minute boundary (see waitForRateLimitWindow).
  test.beforeEach(async () => {
    await waitForRateLimitWindow();
  });

  test('lets three submissions through a minute from one address and refuses the fourth with a 429 and Retry-After', async ({
    submit,
    marker,
    upstream,
  }) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect((await submit()).status(), `submission ${attempt}`).toBe(303);
    }

    const fourth = await submit();

    expect(fourth.status()).toBe(429);
    expect(fourth.headers()['retry-after']).toBe('60');
    expect(fourth.headers()['content-type']).toContain('text/html');
    expect(await fourth.text()).toContain('id="contact-alert"');

    // The refused one asked nothing of the providers: three checks, three emails.
    const calls = await upstream.callsFor(marker);
    expect(calls.filter((c) => c.upstream === 'turnstile')).toHaveLength(3);
    expect(calls.filter((c) => c.upstream === 'emailjs')).toHaveLength(3);
  });

  for (const L of COPY) {
    test(`tells a visitor who is refused to wait, and keeps what they wrote (${L.lang})`, async ({
      page,
      submit,
      marker,
    }) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await submit();
      }
      await page.goto(L.path);
      await fill(page, L, `Wait for me ${marker}`);

      const response = await submitForm(page, L);

      expect(response.status()).toBe(429);
      expect(response.headers()['retry-after']).toBe('60');
      await expect(page).toHaveTitle(`${L.errorWord} ${L.title}`);
      await expect(page.locator('#contact-alert')).toContainText(
        L.alertRateLimited,
      );
      await expect(page.getByLabel(L.message)).toHaveValue(
        `Wait for me ${marker}`,
      );
    });
  }

  test('counts per client address: another address has a budget of its own', async ({
    submit,
  }) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await submit();
    }
    expect((await submit()).status()).toBe(429);

    const other = await submit({
      headers: { 'cf-connecting-ip': '2001:db8:ffff:ffff:ffff:ffff:ffff:2' },
    });

    expect(other.status()).toBe(303);
  });

  test('does not let a client choose its own key with X-Forwarded-For, which anyone can write', async ({
    submit,
  }) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await submit();
    }

    const spoofed = await submit({
      headers: {
        'x-forwarded-for': '198.51.100.77',
        'x-real-ip': '198.51.100.78',
      },
    });

    expect(spoofed.status()).toBe(429);
  });

  test('is the same budget at the Action’s own address, which answers the outcome as data', async ({
    submit,
    marker,
    upstream,
  }) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await submit();
    }

    const rpc = await submit({ path: '/_actions/contact' });

    expect(rpc.status()).toBe(200);
    expect(JSON.parse(await rpc.text())).toEqual([{ kind: 1 }, 'rate_limited']);
    const calls = await upstream.callsFor(marker);
    expect(calls.filter((c) => c.upstream === 'emailjs')).toHaveLength(3);
  });

  test('is checked before Turnstile: a flood never reaches it', async ({
    submit,
    marker,
    upstream,
  }) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await submit();
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submit();
    }

    const checks = (await upstream.callsFor(marker)).filter(
      (c) => c.upstream === 'turnstile',
    );
    expect(checks).toHaveLength(3);
  });

  test('still spends a tokenless submission’s budget, so a bot that sends none cannot try for free', async ({
    submit,
  }) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await submit({
        fields: { 'cf-turnstile-response': undefined },
      });
      expect(response.status()).toBe(400);
    }

    const next = await submit({
      fields: { 'cf-turnstile-response': undefined },
    });

    expect(next.status()).toBe(429);
  });
});

test.describe('the success page on its own', () => {
  for (const L of COPY) {
    test(`shows the message that was sent, with no form, for ?sent=1 (${L.lang})`, async ({
      page,
    }) => {
      const response = await page.goto(L.sentPath);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole('status')).toContainText(L.sent);
      await expect(page.locator('form')).toHaveCount(0);
      await expect(page).toHaveTitle(L.title);
      await expect(page.getByRole('link', { name: L.another })).toHaveAttribute(
        'href',
        L.path,
      );
    });
  }

  test('is not a submission: asking for it sends nothing', async ({
    request,
    marker,
    upstream,
  }) => {
    const response = await request.get(`/contact/?sent=1&m=${marker}`);

    expect(response.status()).toBe(200);
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('is not produced by a GET that names the Action: only a POST runs it', async ({
    request,
    clientIp,
    marker,
    upstream,
  }) => {
    const response = await request.get(`/contact/${ACTION_QUERY}&m=${marker}`, {
      headers: { 'cf-connecting-ip': clientIp },
    });

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('contact-name');
    expect(await upstream.callsFor(marker)).toEqual([]);
  });
});
