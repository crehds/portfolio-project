// The `test` the contact specs use. It adds, to Playwright's own:
//
// - `marker`: a string no other test uses. A test puts it in the visitor's text and in the
//   Turnstile token, and finds its own calls among everything the fake providers recorded
//   (tests run in parallel against one fake).
// - `clientIp`: the address this test submits from, fresh for every run of every test. The
//   rate limit counts per `cf-connecting-ip`, and Miniflare keeps the one a client sends, so
//   a test of its own can neither use up another's budget nor start with a used one (a retry
//   included). Without a header every request counts under the one address 127.0.0.1.
// - `upstream`: what the fake EmailJS and Turnstile recorded.
// - `submit`: a form post straight to the server, as a script would send it, with the
//   headers a browser sends (Origin) and this test's address.
// - A browser context that sends `clientIp`, and a page whose Turnstile widget is the stub
//   (`turnstile-stub.ts`) with a token that passes by default.
//
// No request leaves the machine: the browser cannot resolve any host but the local ones
// (`launchOptions` in playwright.config.ts), and Turnstile's script is answered by the stub
// before the network is asked.
import { randomBytes } from 'node:crypto';
import {
  expect,
  test as base,
  type APIResponse,
  type Page,
} from '@playwright/test';

import { turnstileToken, upstreamClient } from './fake-upstreams';
import { APP_ORIGIN, UPSTREAM_ORIGIN } from './ports';
import { TURNSTILE_API_URL, TURNSTILE_STUB } from './turnstile-stub';

export { expect };

/** The address the contact page posts its form to: itself, with the Action's name. */
export const ACTION_QUERY = '?_action=contact';

export interface SubmitOptions {
  /** Where to post; the English contact page's Action by default. */
  path?: string;
  /** The form fields. A field set to `undefined` is not sent. */
  fields?: Record<string, string | undefined>;
  /**
   * A urlencoded body, sent as it is in place of `fields`: for a test that needs the body to
   * be of an exact size (see form-bodies.ts).
   */
  body?: string;
  /** The Origin header; `null` sends none. The site's own origin by default. */
  origin?: string | null;
  /** Other headers, which win over the ones above. */
  headers?: Record<string, string>;
}

interface ContactFixtures {
  marker: string;
  clientIp: string;
  upstream: ReturnType<typeof upstreamClient>;
  submit: (options?: SubmitOptions) => Promise<APIResponse>;
}

/** An IPv6 address from the documentation range, 2001:db8::/32, so it is never a real client. */
function randomClientIp(): string {
  const groups = Array.from({ length: 4 }, () =>
    randomBytes(2).toString('hex'),
  );
  return `2001:db8:${groups.join(':')}:1`;
}

export const test = base.extend<ContactFixtures>({
  // Playwright wants each fixture's first argument destructured, even when it needs nothing.
  // eslint-disable-next-line no-empty-pattern
  marker: async ({}, use) => {
    await use(`m${randomBytes(8).toString('hex')}`);
  },

  // eslint-disable-next-line no-empty-pattern
  clientIp: async ({}, use) => {
    await use(randomClientIp());
  },

  // eslint-disable-next-line no-empty-pattern
  upstream: async ({}, use) => {
    await use(upstreamClient(UPSTREAM_ORIGIN));
  },

  submit: async ({ request, marker, clientIp }, use) => {
    await use((options = {}) => {
      const fields: Record<string, string | undefined> = {
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        message: `Hello from ${marker}`,
        locale: 'en',
        'cf-turnstile-response': turnstileToken('pass', marker),
        ...options.fields,
      };
      const form = Object.fromEntries(
        Object.entries(fields).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      );
      const origin = options.origin === undefined ? APP_ORIGIN : options.origin;

      return request.post(options.path ?? `/contact/${ACTION_QUERY}`, {
        ...(options.body === undefined ? { form } : { data: options.body }),
        headers: {
          ...(options.body === undefined
            ? {}
            : { 'content-type': 'application/x-www-form-urlencoded' }),
          ...(origin === null ? {} : { origin }),
          'cf-connecting-ip': clientIp,
          ...options.headers,
        },
        // A redirect is an answer to look at, not one to follow.
        maxRedirects: 0,
      });
    });
  },

  context: async ({ context, clientIp }, use) => {
    await context.setExtraHTTPHeaders({ 'cf-connecting-ip': clientIp });
    await context.route(TURNSTILE_API_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: TURNSTILE_STUB,
      }),
    );
    await use(context);
  },

  page: async ({ page, marker }, use) => {
    await useWidgetToken(page, turnstileToken('pass', marker));
    await use(page);
  },
});

/**
 * Runs `attempt` again, up to `attempts` times, when the connection is reset or the answer
 * is a server error. Meant for a post the server refuses from its headers alone, such as a
 * body past the size limit: it answers 413 without reading the upload, and the local preview
 * server (the Cloudflare plugin's proxy to Miniflare) sometimes fails while the client is
 * still sending it, in about one post in eighty: the client sees the connection reset, or
 * once in a while a 500. Production has no such proxy. Only those two outcomes are retried:
 * any other answer, a wrong 4xx or a 200 included, is returned as it is, and a server error
 * that persists through every attempt is returned too, and fails the test.
 *
 * A retry never goes unseen: each retried attempt leaves an annotation on the test (type
 * `proxy-retry`, shown in the HTML report) and a warning on the console, naming the attempt
 * and its cause, the status or the keyword of the error. A proxy that fails more often than
 * one post in eighty then shows in the report instead of passing as a clean run.
 */
export async function retryOnProxyFailure(
  attempt: () => Promise<APIResponse>,
  attempts = 5,
): Promise<APIResponse> {
  for (let tried = 1; ; tried += 1) {
    let cause: string;

    try {
      const response = await attempt();
      if (response.status() < 500 || tried >= attempts) {
        return response;
      }
      cause = `HTTP ${response.status()}`;
    } catch (error) {
      const keyword =
        error instanceof Error
          ? /aborted|ECONNRESET|socket hang up/i.exec(error.message)?.[0]
          : undefined;
      if (keyword === undefined || tried >= attempts) {
        throw error;
      }
      cause = keyword;
    }

    noteRetry(tried, attempts, cause);
  }
}

/**
 * Leaves the trace of a retried attempt: the cause only, never the message of an error,
 * which for a failed request carries its whole call log.
 */
function noteRetry(tried: number, attempts: number, cause: string): void {
  const description = `attempt ${tried} of ${attempts} failed: ${cause}`;

  test.info().annotations.push({ type: 'proxy-retry', description });
  console.warn(`retryOnProxyFailure: ${description}; trying again`);
}

/**
 * Sets the token the widget stub puts in the form of pages this page loads from now on:
 * a string, or `null` for a widget that never produced one. A later call wins.
 */
export async function useWidgetToken(
  page: Page,
  token: string | null,
): Promise<void> {
  await page.addInitScript((value) => {
    (
      window as unknown as { __E2E_TURNSTILE__: { token: string | null } }
    ).__E2E_TURNSTILE__ = { token: value };
  }, token);
}

/** What the page asked Turnstile for: one entry per widget the stub found. */
export async function widgetRenders(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __e2eTurnstileRenders?: {
            sitekey: string | null;
            language: string | null;
            size: string | null;
            theme: string | null;
          }[];
        }
      ).__e2eTurnstileRenders ?? [],
  );
}
