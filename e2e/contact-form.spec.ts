import {
  ACTION_QUERY,
  expect,
  test,
  widgetRenders,
} from './support/contact-test';
import { turnstileToken } from './support/fake-upstreams';

// The contact form against the real Worker (a build with the fake providers, see
// e2e/support). What a visitor sees for each state is covered in detail, in both
// locales, by src/components/contact/contact-page.test.ts and
// src/modules/contact/page-state.test.ts; these tests prove the pieces work together:
// the page, Astro's Action, the schema, the rate limit and the providers.

const SITE_KEY = '1x00000000000000000000BB';

const locales = [
  {
    lang: 'en',
    path: '/contact/',
    sentPath: '/contact/?sent=1',
    name: 'Name',
    email: 'Email address',
    message: 'Message',
    submit: 'Send message',
    sent: 'Your message was sent. Thank you!',
    another: 'Send another message',
    summary: 'There is a problem with the form',
    errorWord: 'Error:',
    nameRequired: 'Enter your name.',
    emailRequired: 'Enter your email address.',
    emailInvalid: 'Enter a valid email address, like name@example.com.',
    messageRequired: 'Enter a message.',
    title: 'Contact — Carlos Rodríguez Huerta',
  },
  {
    lang: 'es',
    path: '/es/contact/',
    sentPath: '/es/contact/?sent=1',
    name: 'Nombre',
    email: 'Correo electrónico',
    message: 'Mensaje',
    submit: 'Enviar mensaje',
    sent: 'Tu mensaje fue enviado. ¡Gracias!',
    another: 'Enviar otro mensaje',
    summary: 'Hay un problema con el formulario',
    errorWord: 'Error:',
    nameRequired: 'Escribe tu nombre.',
    emailRequired: 'Escribe tu correo electrónico.',
    emailInvalid:
      'Escribe un correo electrónico válido, como nombre@ejemplo.com.',
    messageRequired: 'Escribe un mensaje.',
    title: 'Contacto — Carlos Rodríguez Huerta',
  },
];

for (const L of locales) {
  test.describe(`the contact form in the browser (${L.lang})`, () => {
    test('shows a form with a labelled field for each thing it asks', async ({
      page,
    }) => {
      await page.goto(L.path);

      await expect(page.getByLabel(L.name)).toHaveAttribute(
        'autocomplete',
        'name',
      );
      await expect(page.getByLabel(L.email)).toHaveAttribute(
        'autocomplete',
        'email',
      );
      await expect(page.getByLabel(L.message)).toBeVisible();
      await expect(page.getByRole('button', { name: L.submit })).toBeVisible();
    });

    test('asks Turnstile for one flexible widget in the page language, with the site key from the Worker’s settings', async ({
      page,
    }) => {
      await page.goto(L.path);

      await expect
        .poll(() => widgetRenders(page))
        .toEqual([
          {
            sitekey: SITE_KEY,
            language: L.lang,
            size: 'flexible',
            theme: expect.stringMatching(/^(light|dark)$/),
          },
        ]);
    });

    for (const colorScheme of ['light', 'dark'] as const) {
      test(`gives the widget the site’s theme, not only the OS preference (${colorScheme})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(L.path);

        await expect
          .poll(async () => (await widgetRenders(page))[0]?.theme)
          .toBe(colorScheme);
      });
    }

    test('gives the widget the theme the visitor chose when it differs from the OS preference', async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'light');
      });
      await page.goto(L.path);

      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect
        .poll(async () => (await widgetRenders(page))[0]?.theme)
        .toBe('light');
    });

    test('sends a message: the page redirects to its success address and one email goes out with exactly what was typed', async ({
      page,
      marker,
      upstream,
      clientIp,
    }) => {
      await page.goto(L.path);
      await page.getByLabel(L.name).fill('Ada Lovelace');
      await page.getByLabel(L.email).fill('ada@example.com');
      await page.getByLabel(L.message).fill(`Hello from ${marker}`);
      await page.getByRole('button', { name: L.submit }).click();

      await expect(page).toHaveURL(
        (url) => url.pathname + url.search === L.sentPath,
      );
      await expect(page.getByRole('status')).toContainText(L.sent);
      await expect(page).toHaveTitle(L.title);
      await expect(page.getByLabel(L.name)).toHaveCount(0);

      const calls = await upstream.callsFor(marker);
      const emails = calls.filter((call) => call.upstream === 'emailjs');
      expect(emails).toHaveLength(1);
      expect(emails[0].body).toEqual({
        service_id: 'e2e-service-id',
        template_id: 'e2e-template-id',
        user_id: 'e2e-public-key',
        accessToken: 'e2e-private-key',
        template_params: {
          from_name: 'Ada Lovelace',
          reply_to: 'ada@example.com',
          message: `Hello from ${marker}`,
          locale: L.lang,
        },
      });

      // Turnstile was asked once, with the widget's token, the secret key and the client.
      const checks = calls.filter((call) => call.upstream === 'turnstile');
      expect(checks).toHaveLength(1);
      expect(checks[0].body).toEqual({
        secret: '1x0000000000000000000000000000000AA',
        response: turnstileToken('pass', marker),
        remoteip: clientIp,
      });
    });

    test('does not send the message again when the success page is reloaded', async ({
      page,
      marker,
      upstream,
    }) => {
      await page.goto(L.path);
      await page.getByLabel(L.name).fill('Ada');
      await page.getByLabel(L.email).fill('ada@example.com');
      await page.getByLabel(L.message).fill(`Reload ${marker}`);
      await page.getByRole('button', { name: L.submit }).click();
      await expect(page.getByRole('status')).toContainText(L.sent);

      await page.reload();

      await expect(page.getByRole('status')).toContainText(L.sent);
      const emails = (await upstream.callsFor(marker)).filter(
        (call) => call.upstream === 'emailjs',
      );
      expect(emails).toHaveLength(1);
    });

    test('offers another message from the success page, which opens the form again', async ({
      page,
      marker,
    }) => {
      await page.goto(L.path);
      await page.getByLabel(L.name).fill('Ada');
      await page.getByLabel(L.email).fill('ada@example.com');
      await page.getByLabel(L.message).fill(`Again ${marker}`);
      await page.getByRole('button', { name: L.submit }).click();

      await page.getByRole('link', { name: L.another }).click();

      await expect(page).toHaveURL(
        (url) => url.pathname + url.search === L.path,
      );
      await expect(page.getByLabel(L.name)).toHaveValue('');
    });

    test('can be filled in and sent with the keyboard alone', async ({
      page,
      marker,
      upstream,
    }) => {
      await page.goto(L.path);

      await page.getByLabel(L.name).focus();
      await page.keyboard.type('Ada Lovelace');
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(L.email)).toBeFocused();
      await page.keyboard.type('ada@example.com');
      await page.keyboard.press('Tab');
      await expect(page.getByLabel(L.message)).toBeFocused();
      await page.keyboard.type(`Typed ${marker}`);
      await page.keyboard.press('Tab');
      const submit = page.getByRole('button', { name: L.submit });
      await expect(submit).toBeFocused();
      await page.keyboard.press('Enter');

      await expect(page.getByRole('status')).toContainText(L.sent);
      const emails = (await upstream.callsFor(marker)).filter(
        (call) => call.upstream === 'emailjs',
      );
      expect(emails).toHaveLength(1);
    });

    test('answers an incomplete form with a 400, an error summary and an error under each field that needs one, and keeps what was typed', async ({
      page,
      marker,
      upstream,
    }) => {
      await page.goto(L.path);
      await page.getByLabel(L.name).fill(`Ada ${marker}`);
      await page.getByLabel(L.email).fill('not-an-email');

      const [response] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === 'POST'),
        page.getByRole('button', { name: L.submit }).click(),
      ]);

      expect(response.status()).toBe(400);
      await expect(page).toHaveTitle(`${L.errorWord} ${L.title}`);

      const summary = page.locator('#contact-error-summary');
      await expect(summary).toHaveAttribute('role', 'alert');
      await expect(summary).toContainText(L.summary);
      await expect(
        summary.getByRole('link', { name: `${L.errorWord} ${L.emailInvalid}` }),
      ).toHaveAttribute('href', '#contact-email');
      await expect(
        summary.getByRole('link', {
          name: `${L.errorWord} ${L.messageRequired}`,
        }),
      ).toHaveAttribute('href', '#contact-message');
      await expect(summary.getByRole('link')).toHaveCount(2);

      await expect(page.locator('#contact-email-error')).toHaveText(
        `${L.errorWord} ${L.emailInvalid}`,
      );
      await expect(page.locator('#contact-message-error')).toHaveText(
        `${L.errorWord} ${L.messageRequired}`,
      );
      await expect(page.locator('#contact-name-error')).toHaveCount(0);

      await expect(page.getByLabel(L.email)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      await expect(page.getByLabel(L.email)).toHaveAttribute(
        'aria-describedby',
        'contact-email-error',
      );
      await expect(page.getByLabel(L.name)).not.toHaveAttribute('aria-invalid');

      await expect(page.getByLabel(L.name)).toHaveValue(`Ada ${marker}`);
      await expect(page.getByLabel(L.email)).toHaveValue('not-an-email');
      await expect(page.getByLabel(L.message)).toHaveValue('');

      // A refused form asks nothing of the providers.
      expect(await upstream.callsFor(marker)).toEqual([]);
    });

    test('moves the focus to the field when an error in the summary is followed', async ({
      page,
    }) => {
      await page.goto(L.path);
      await page.getByRole('button', { name: L.submit }).click();

      await page
        .locator('#contact-error-summary')
        .getByRole('link', { name: `${L.errorWord} ${L.emailRequired}` })
        .click();

      await expect(page.getByLabel(L.email)).toBeFocused();
    });

    test('reports all three fields of an empty form', async ({ page }) => {
      await page.goto(L.path);
      await page.getByRole('button', { name: L.submit }).click();

      await expect(page.locator('#contact-name-error')).toHaveText(
        `${L.errorWord} ${L.nameRequired}`,
      );
      await expect(page.locator('#contact-email-error')).toHaveText(
        `${L.errorWord} ${L.emailRequired}`,
      );
      await expect(page.locator('#contact-message-error')).toHaveText(
        `${L.errorWord} ${L.messageRequired}`,
      );
    });

    test('writes what the visitor typed back as text, never as markup', async ({
      page,
    }) => {
      await page.goto(L.path);
      const typed = '"><img src=x onerror="window.__pwned = 1">';
      await page.getByLabel(L.name).fill(typed);
      await page
        .getByLabel(L.email)
        .fill('<script>window.__pwned = 2</script>');
      await page
        .getByLabel(L.message)
        .fill('</textarea><b id="injected">hi</b>');
      await page.getByRole('button', { name: L.submit }).click();

      await expect(page.locator('#contact-error-summary')).toBeVisible();
      await expect(page.getByLabel(L.name)).toHaveValue(typed);
      await expect(page.getByLabel(L.email)).toHaveValue(
        '<script>window.__pwned = 2</script>',
      );
      await expect(page.getByLabel(L.message)).toHaveValue(
        '</textarea><b id="injected">hi</b>',
      );
      await expect(page.locator('img[src="x"]')).toHaveCount(0);
      await expect(page.locator('#injected')).toHaveCount(0);
      expect(
        await page.evaluate(
          () => (window as unknown as { __pwned?: number }).__pwned,
        ),
      ).toBeUndefined();
    });
  });
}

test.describe('Turnstile’s script', () => {
  test('is loaded by the contact pages only', async ({ page }) => {
    for (const path of [
      '/',
      '/projects/',
      '/skills/',
      '/es/',
      '/es/experience/',
    ]) {
      await page.goto(path);

      await expect(
        page.locator('script[src*="challenges.cloudflare.com"]'),
        path,
      ).toHaveCount(0);
      await expect(page.locator('.cf-turnstile'), path).toHaveCount(0);
    }

    for (const path of ['/contact/', '/es/contact/']) {
      await page.goto(path);

      const script = page.locator('script[src*="challenges.cloudflare.com"]');
      await expect(script, path).toHaveCount(1);
      await expect(script).toHaveAttribute(
        'src',
        'https://challenges.cloudflare.com/turnstile/v0/api.js',
      );
      await expect(script).toHaveAttribute('async', '');
      await expect(script).toHaveAttribute('defer', '');
    }
  });
});

test.describe('posting the form to the page', () => {
  for (const L of locales) {
    test(`answers a valid post with a 303 to the page’s own success address (${L.lang})`, async ({
      submit,
      marker,
      upstream,
    }) => {
      const response = await submit({
        path: `${L.path}${ACTION_QUERY}`,
        fields: { locale: L.lang },
      });

      expect(response.status()).toBe(303);
      expect(response.headers()['location']).toBe(L.sentPath);
      const emails = (await upstream.callsFor(marker)).filter(
        (call) => call.upstream === 'emailjs',
      );
      expect(emails).toHaveLength(1);
    });
  }

  test('redirects to the page it was posted to, whatever its own locale field says', async ({
    submit,
  }) => {
    const english = await submit({
      path: `/contact/${ACTION_QUERY}`,
      fields: { locale: 'es' },
    });
    const spanish = await submit({
      path: `/es/contact/${ACTION_QUERY}`,
      fields: { locale: 'en' },
    });

    expect(english.headers()['location']).toBe('/contact/?sent=1');
    expect(spanish.headers()['location']).toBe('/es/contact/?sent=1');
  });

  test('never redirects anywhere a visitor chose: other fields and the query string are not read', async ({
    submit,
  }) => {
    const response = await submit({
      path: `/contact/${ACTION_QUERY}&next=https://evil.example/&sent=0`,
      fields: { next: 'https://evil.example/', redirect: '//evil.example' },
    });

    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/contact/?sent=1');
  });

  test('refuses a post from another origin with a 403, and asks nothing of the providers', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({ origin: 'https://evil.example' });

    expect(response.status()).toBe(403);
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('refuses a post that names no origin with a 403, and asks nothing of the providers', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({ origin: null });

    expect(response.status()).toBe(403);
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('answers invalid input with a 400 and the page, and asks nothing of the providers', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({
      fields: { name: `Ada ${marker}`, email: 'nope' },
    });

    expect(response.status()).toBe(400);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(await response.text()).toContain('contact-email-error');
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('says a message past its limit is too long, keeps it, and asks nothing of the providers', async ({
    submit,
    marker,
    upstream,
  }) => {
    const long = `${marker} ${'x'.repeat(5001)}`;

    const response = await submit({ fields: { message: long } });

    expect(response.status()).toBe(400);
    const html = await response.text();
    expect(html).toContain('Your message must be 5000 characters or fewer.');
    expect(html).toContain(long);
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('refuses a locale the site does not have', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({ fields: { locale: 'fr' } });

    expect(response.status()).toBe(400);
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('rejects a body past the size limit with a 413 and the page, and asks nothing of the providers', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({
      fields: { message: `${marker} ${'x'.repeat(40 * 1024)}` },
    });

    expect(response.status()).toBe(413);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(await upstream.callsFor(marker)).toEqual([]);
  });
});

// Astro exposes every Action at /_actions/<name> as well. It has to get the same checks as
// the page, since a script can post to it directly.
test.describe('the Action’s own address, /_actions/contact', () => {
  const rpc = `/_actions/contact`;

  test('takes a valid form like the page does: one email, and the outcome as the answer', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({ path: rpc });

    expect(response.status()).toBe(200);
    expect(JSON.parse(await response.text())).toEqual([{ kind: 1 }, 'sent']);
    const emails = (await upstream.callsFor(marker)).filter(
      (call) => call.upstream === 'emailjs',
    );
    expect(emails).toHaveLength(1);
  });

  test('refuses another origin with a 403, and asks nothing of the providers', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({
      path: rpc,
      origin: 'https://evil.example',
    });

    expect(response.status()).toBe(403);
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('answers invalid input with a 400 that names the fields, and asks nothing of the providers', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({
      path: rpc,
      fields: { name: `Ada ${marker}`, email: 'nope', message: undefined },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.type).toBe('AstroActionInputError');
    expect(body.fields).toEqual({
      email: ['invalid_email'],
      message: ['required'],
    });
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('refuses JSON, which a form Action does not take, with a 415', async ({
    request,
    clientIp,
    marker,
    upstream,
  }) => {
    const response = await request.post(rpc, {
      data: { name: `Ada ${marker}`, email: 'ada@example.com', message: 'hi' },
      headers: {
        origin: 'http://localhost:4331',
        'cf-connecting-ip': clientIp,
      },
    });

    expect(response.status()).toBe(415);
    expect(await upstream.callsFor(marker)).toEqual([]);
  });

  test('rejects a body past the size limit with a 413', async ({
    submit,
    marker,
    upstream,
  }) => {
    const response = await submit({
      path: rpc,
      fields: { message: `${marker} ${'x'.repeat(40 * 1024)}` },
    });

    expect(response.status()).toBe(413);
    expect((await response.json()).code).toBe('CONTENT_TOO_LARGE');
    expect(await upstream.callsFor(marker)).toEqual([]);
  });
});
