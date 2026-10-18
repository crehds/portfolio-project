// The `test` every browser spec uses. It is Playwright's own plus one automatic fixture, the
// CSP guard: it listens, in every page and frame the test opens, for the browser's
// `securitypolicyviolation` event, and fails the test when it ends with any. A page that
// breaks its own Content-Security-Policy (an inline script whose hash went stale, a host the
// policy does not name) then fails the suite that visited it, whatever that suite was
// checking. `csp-guard.spec.ts` is the negative control that proves the guard hears.
//
// The event reaches Node through a context binding, set before any page script runs, so a
// violation during the first parse of a document is not lost, and it survives navigations.
// When the test ends the guard first settles (`settleCspViolations`), so a violation the page
// raised at the very end of the body is counted too. A test that provokes a violation on
// purpose takes it out of `cspViolations` itself.
import { test as base, expect, type BrowserContext } from '@playwright/test';

export { expect };

/** What the browser says about a blocked resource or script. */
export interface CspViolation {
  /** The directive that blocked it, such as `script-src-elem`. */
  effectiveDirective: string;
  /** The address of a blocked resource, `inline` or `eval` for code, or an origin. */
  blockedURI: string;
  /** `enforce` for the policy of a header; `report` for a report-only one. */
  disposition: string;
  /** The page it happened on. */
  documentURI: string;
}

declare global {
  interface Window {
    __reportCspViolation?: (violation: CspViolation) => void;
  }
}

/**
 * Waits for the violations that already happened to reach `violations`. A violation travels
 * from the page to Node through the binding, which is a message of its own, so the test body
 * can end (and the guard check) while one is still in flight. The page answers a request after
 * the messages it sent before it, so a round trip through each of its frames, with a task
 * boundary in between for the event the test body provoked last to be dispatched, leaves every
 * earlier violation delivered. It cannot wait for one the page has not raised yet.
 */
export async function settleCspViolations(context: BrowserContext) {
  for (const page of context.pages()) {
    for (const frame of page.frames()) {
      const roundTrip = frame
        .evaluate(
          () =>
            new Promise<void>((resolve) =>
              setTimeout(() => setTimeout(resolve, 0), 0),
            ),
        )
        .catch(() => undefined);
      // A page with JavaScript off never answers, and has no script to raise a violation: do
      // not wait for it past the time a live page takes.
      await Promise.race([roundTrip, new Promise((r) => setTimeout(r, 1000))]);
    }
  }
}

export const test = base.extend<{ cspViolations: CspViolation[] }>({
  cspViolations: [
    async ({ context }, use) => {
      const violations: CspViolation[] = [];

      await context.exposeBinding(
        '__reportCspViolation',
        (_source, violation: CspViolation) => {
          violations.push(violation);
        },
      );
      await context.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          window.__reportCspViolation?.({
            effectiveDirective: event.effectiveDirective,
            blockedURI: event.blockedURI,
            disposition: event.disposition,
            documentURI: event.documentURI,
          });
        });
      });

      await use(violations);
      await settleCspViolations(context);

      expect(
        violations,
        'The page broke its own Content-Security-Policy (src/shared/security/headers.ts)',
      ).toEqual([]);
    },
    { auto: true },
  ],
});
