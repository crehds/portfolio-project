import { expect, test as plain } from '@playwright/test';

import { test } from './support/contact-test';
import { TURNSTILE_API_URL } from './support/turnstile-stub';

// Nothing a test does may leave the machine. Two layers hold that for the browser: it
// cannot resolve any host but the local ones (a launch option in playwright.config.ts, for
// every spec), and the contact specs answer Turnstile's script themselves.

plain.describe('the browser', () => {
  // example.com is the host IANA reserves for documentation: a request that did get out would
  // be harmless, and an unblocked browser would load it, which is what tells the two apart.
  plain(
    'cannot resolve a host that is not local, so nothing it loads can leave the machine',
    async ({ page }) => {
      await expect(page.goto('http://example.com/')).rejects.toThrow(
        /ERR_NAME_NOT_RESOLVED/,
      );
    },
  );

  plain('still reaches the local site', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
  });
});

test.describe('the contact specs’ browser', () => {
  test('gets the widget stub, not the network, at Turnstile’s script address', async ({
    page,
  }) => {
    const response = await page.goto(TURNSTILE_API_URL);

    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/javascript');
    expect(await response?.text()).toContain('cf-turnstile-response');
  });
});
