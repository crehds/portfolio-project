import { ACTION_BODY_LIMIT_BYTES } from '../src/modules/contact/form-body-limit';
import {
  expect,
  retryOnProxyFailure,
  test,
  useWidgetToken,
} from './support/contact-test';
import {
  LARGEST,
  THREE_BYTE_CHARACTER,
  TWO_BYTE_CHARACTER,
  bodyOfExactly,
  largestFields,
  urlencoded,
} from './support/form-bodies';

// `security.actionBodySizeLimit` (src/modules/contact/form-body-limit.ts) refuses a body before
// it is parsed, so nobody can make the Worker read and buffer a megabyte per request. It must
// not refuse a visitor: a browser sends the form urlencoded, which writes each byte of a
// non-ASCII character as three, so a message at its limit in a script of three-byte
// characters, with the other fields and a token at theirs, is about 48 KB, and one in a script
// of two-byte characters already passes the old limit of 32 KiB. The unit tests tie the limit
// to the schema's own (form-body-limit.test.ts); these prove it on the real Worker.

const OLD_LIMIT_BYTES = 32 * 1024;

const scripts = [
  ['three-byte characters (CJK)', THREE_BYTE_CHARACTER],
  ['two-byte characters (Cyrillic)', TWO_BYTE_CHARACTER],
] as const;

test.describe('the largest submission the form can send', () => {
  for (const [label, character] of scripts) {
    test(`is read whole and sent through the page: every field at its limit, in ${label}`, async ({
      submit,
      marker,
      upstream,
    }) => {
      const fields = largestFields(marker, character);
      const body = urlencoded(fields);
      // The test is about the boundary: more than the old limit, and inside the new one.
      expect(body.length).toBeGreaterThan(OLD_LIMIT_BYTES);
      expect(body.length).toBeLessThanOrEqual(ACTION_BODY_LIMIT_BYTES);

      const response = await submit({ body });

      expect(response.status()).toBe(303);
      expect(response.headers()['location']).toBe('/contact/?sent=1');

      const calls = await upstream.callsFor(marker);
      const emails = calls.filter((call) => call.upstream === 'emailjs');
      expect(emails).toHaveLength(1);
      expect(emails[0].body).toMatchObject({
        template_params: {
          from_name: fields.name,
          reply_to: fields.email,
          message: fields.message,
          locale: 'en',
        },
      });
      // Turnstile was asked about the whole token, 2,048 characters of it.
      const checks = calls.filter((call) => call.upstream === 'turnstile');
      expect(checks).toHaveLength(1);
      expect(checks[0].body).toMatchObject({
        response: fields['cf-turnstile-response'],
      });
      expect(fields['cf-turnstile-response']).toHaveLength(LARGEST.token);
    });

    test(`is read whole and sent at the Action’s own address too, in ${label}`, async ({
      submit,
      marker,
      upstream,
    }) => {
      const fields = largestFields(marker, character);
      const body = urlencoded(fields);
      expect(body.length).toBeGreaterThan(OLD_LIMIT_BYTES);

      const response = await submit({ path: '/_actions/contact', body });

      expect(response.status()).toBe(200);
      expect(JSON.parse(await response.text())).toEqual([{ kind: 1 }, 'sent']);
      const emails = (await upstream.callsFor(marker)).filter(
        (call) => call.upstream === 'emailjs',
      );
      expect(emails).toHaveLength(1);
      expect(emails[0].body).toMatchObject({
        template_params: { message: fields.message },
      });
    });
  }

  test('can be written and sent from the browser, which encodes the form as it would for any visitor', async ({
    page,
    marker,
    upstream,
  }) => {
    const fields = largestFields(marker, THREE_BYTE_CHARACTER);
    await useWidgetToken(page, fields['cf-turnstile-response']);
    await page.goto('/contact/');

    await page.getByLabel('Name').fill(fields.name);
    await page.getByLabel('Email address').fill(fields.email);
    await page.getByLabel('Message').fill(fields.message);
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByRole('status')).toContainText(
      'Your message was sent.',
    );
    const emails = (await upstream.callsFor(marker)).filter(
      (call) => call.upstream === 'emailjs',
    );
    expect(emails).toHaveLength(1);
    expect(emails[0].body).toMatchObject({
      template_params: {
        from_name: fields.name,
        reply_to: fields.email,
        message: fields.message,
      },
    });
  });
});

const doors = [
  ['the page', '/contact/?_action=contact'],
  ['the Action’s own address', '/_actions/contact'],
] as const;

test.describe('the limit itself', () => {
  for (const [door, path] of doors) {
    test(`reads a body of exactly ${ACTION_BODY_LIMIT_BYTES} bytes, and refuses it for what it says, not for its size (${door})`, async ({
      submit,
      marker,
      upstream,
    }) => {
      const body = bodyOfExactly(ACTION_BODY_LIMIT_BYTES, marker);
      expect(body).toHaveLength(ACTION_BODY_LIMIT_BYTES);

      const response = await submit({ path, body });

      // Read, so the schema judged it: a message of tens of thousands of characters.
      expect(response.status()).toBe(400);
      if (path.startsWith('/_actions')) {
        expect((await response.json()).fields).toEqual({
          message: ['too_long'],
        });
      } else {
        expect(await response.text()).toContain(
          'Your message must be 5000 characters or fewer.',
        );
      }
      expect(await upstream.callsFor(marker)).toEqual([]);
    });

    test(`refuses a body one byte over the limit before reading it, with a 413 (${door})`, async ({
      submit,
      marker,
      upstream,
    }) => {
      const body = bodyOfExactly(ACTION_BODY_LIMIT_BYTES + 1, marker);
      expect(body).toHaveLength(ACTION_BODY_LIMIT_BYTES + 1);

      const response = await retryOnProxyFailure(() => submit({ path, body }));

      expect(response.status()).toBe(413);
      if (path.startsWith('/_actions')) {
        const answer = await response.json();
        expect(answer.code).toBe('CONTENT_TOO_LARGE');
        // The message names the limit the Worker really runs with.
        expect(answer.message).toContain(String(ACTION_BODY_LIMIT_BYTES));
      } else {
        expect(response.headers()['content-type']).toContain('text/html');
        expect(await response.text()).toContain('id="contact-alert"');
      }
      expect(await upstream.callsFor(marker)).toEqual([]);
    });
  }
});
