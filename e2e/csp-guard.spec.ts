import { expect, test } from './support/csp-guard';

// The guard (support/csp-guard.ts) makes every spec that uses its `test` fail when the page
// breaks its own Content-Security-Policy. A guard that never fires would pass for the wrong
// reason, so this is its negative control: a script the policy does not allow is put in the
// page, the browser blocks it, and the guard has to have heard.

test.describe('the CSP guard', () => {
  test('reports an inline script the policy does not allow, and the script does not run', async ({
    page,
    cspViolations,
  }) => {
    await page.goto('/');
    expect(cspViolations).toEqual([]);

    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__injected = true;';
      document.head.append(script);
    });

    await expect.poll(() => cspViolations.length).toBe(1);
    expect(cspViolations[0]).toMatchObject({
      effectiveDirective: 'script-src-elem',
      disposition: 'enforce',
    });
    expect(
      await page.evaluate(
        () => (window as unknown as { __injected?: boolean }).__injected,
      ),
    ).toBeUndefined();

    // The violation was the point of this test: take it out of the list the guard checks
    // when the test ends.
    cspViolations.length = 0;
  });

  test('reports a script from another host', async ({
    page,
    cspViolations,
  }) => {
    await page.goto('/');

    await page.evaluate(() => {
      const script = document.createElement('script');
      script.src = 'https://example.com/x.js';
      document.head.append(script);
    });

    await expect.poll(() => cspViolations.length).toBe(1);
    expect(cspViolations[0]).toMatchObject({
      effectiveDirective: 'script-src-elem',
      blockedURI: 'https://example.com/x.js',
    });

    cspViolations.length = 0;
  });

  test('hears nothing from a page that keeps to its policy', async ({
    page,
    cspViolations,
  }) => {
    for (const path of [
      '/',
      '/es/',
      '/projects/',
      '/skills/',
      '/no-such-page',
    ]) {
      await page.goto(path);
    }

    expect(cspViolations).toEqual([]);
  });
});
