// How long the rate limit counts in, in milliseconds: the `period` of the CONTACT_RATE_LIMIT
// binding in wrangler.jsonc (a unit test keeps it equal to the page's `Retry-After`).
const WINDOW_MS = 60_000;

/** The clock and the sleep, replaceable so a test of this module needs neither. */
interface Timing {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const REAL_TIMING: Timing = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Waits, when it has to, until at least `atLeastMs` of the current rate limit window are
 * left, so that a burst of requests a test is about to send counts in one window.
 *
 * Miniflare's local rate limiter counts in fixed windows aligned to the wall clock (a
 * request belongs to window `floor(now / period)`), so a burst that straddles a boundary
 * starts over in the middle of it, and the fourth post of a minute can be let through. That
 * would make every test that expects a refusal fail now and then, a few runs in a hundred.
 * Cloudflare's own limiter is described as permissive and eventually consistent, so a test
 * could never rely on it to the request in production, and does not: this is about the
 * local emulation the end-to-end tests run against. A test that sends one submission, or
 * that only expects submissions to go through, never needs this.
 */
export async function waitForRateLimitWindow(
  atLeastMs = 15_000,
  timing: Timing = REAL_TIMING,
): Promise<void> {
  const left = WINDOW_MS - (timing.now() % WINDOW_MS);

  if (left < atLeastMs) {
    // Past the boundary, so the next window has begun when the test goes on.
    await timing.sleep(left + 100);
  }
}
