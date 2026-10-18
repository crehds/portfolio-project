import { checkAllLinks } from './support/link-crawl';
import { expect, test } from './support/csp-guard';

// The launch gate for links: every link and same-origin resource of every page resolves, a
// `#fragment` finds its element, `mailto:` and `tel:` are well formed, and a link to another
// site is https and goes to a host on the allowlist (src/shared/links/external-hosts.ts).
// Nothing here requests another site; whether those answer is for an online check.
//
// The pages come from the sitemap the server serves, read when the test runs (the harness
// has built and started it by then), plus the two 404 pages. The crawl and its rules live in
// support/link-crawl.ts; the pure judgments are unit-tested in src/shared/links.

test('every link on every page resolves, and is well formed', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const result = await checkAllLinks(page, request);

  // A floor, so a crawl that found nothing (a changed selector, a missing sitemap) cannot
  // pass: the known routes are all there, and links of each kind were seen.
  expect(result.pages).toEqual(
    expect.arrayContaining([
      '/',
      '/es/',
      '/contact/',
      '/es/contact/',
      '/no-such-page',
      '/es/no-such-page',
    ]),
  );
  expect(result.seen.internal).toBeGreaterThan(0);
  expect(result.seen.fragment).toBeGreaterThan(0);
  expect(result.seen.mailto).toBeGreaterThan(0);
  expect(result.seen.external).toBeGreaterThan(0);

  expect(result.problems).toEqual([]);
});
