import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';

import { retryOnProxyFailure } from './support/contact-test';
import {
  assertHermeticBuild,
  assertServerReadsE2eSettings,
  buildOutputProblems,
  e2eVarsProblems,
  parseDevVars,
  renderedSiteKey,
  siteKeyProblems,
} from './support/hermetic-guard';
import {
  emailjsFailure,
  startFakeUpstreams,
  turnstileToken,
  upstreamClient,
  type FakeUpstreams,
} from './support/fake-upstreams';
import { waitForRateLimitWindow } from './support/rate-limit-window';
import { EMAILJS_PATH, TURNSTILE_PATH, UPSTREAM_ORIGIN } from './support/ports';

// The harness is what keeps the end-to-end tests from ever reaching a real provider, so it
// is tested like any other code. Nothing here needs the site: the fake upstreams run on a
// port of their own, and the guard reads files in a temporary directory.

test.describe('the fake upstreams', () => {
  let upstreams: FakeUpstreams;

  test.beforeAll(async () => {
    upstreams = await startFakeUpstreams({ port: 0 });
  });

  test.afterAll(async () => {
    await upstreams.close();
  });

  const emailBody = (message: string) =>
    JSON.stringify({
      service_id: 's',
      template_id: 't',
      user_id: 'u',
      accessToken: 'a',
      template_params: {
        from_name: 'Ada',
        reply_to: 'ada@example.com',
        message,
        locale: 'en',
      },
    });

  const postEmail = (message: string) =>
    fetch(upstreams.emailjsUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: emailBody(message),
    });

  const postTurnstile = (token: string) =>
    fetch(upstreams.turnstileUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: 'secret',
        response: token,
        remoteip: '2001:db8::1',
      }).toString(),
    });

  test('serves the two provider endpoints at the paths the .dev.vars.e2e seams use', async () => {
    expect(upstreams.emailjsUrl).toBe(`${upstreams.origin}${EMAILJS_PATH}`);
    expect(upstreams.turnstileUrl).toBe(`${upstreams.origin}${TURNSTILE_PATH}`);
  });

  test('answers a health check that names itself', async () => {
    const health = await upstreamClient(upstreams.origin).health();

    expect(health).toEqual({ ok: true, role: 'e2e-fake-upstreams' });
  });

  test('answers EmailJS with a 200 and the text OK, like the real service', async () => {
    const response = await postEmail('hello marker-ok-1');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });

  test('records an EmailJS call with its parsed body, and finds it by marker', async () => {
    await postEmail('first marker-find-1');
    await postEmail('second marker-find-2');

    const calls = await upstreamClient(upstreams.origin).callsFor(
      'marker-find-1',
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      upstream: 'emailjs',
      method: 'POST',
      path: EMAILJS_PATH,
    });
    expect(calls[0].body).toMatchObject({
      template_params: { message: 'first marker-find-1', locale: 'en' },
    });
  });

  test('finds nothing for a marker no call carries', async () => {
    expect(
      await upstreamClient(upstreams.origin).callsFor('marker-nobody-sent'),
    ).toEqual([]);
  });

  test('answers the status a message asks for, and still records the call', async () => {
    const response = await postEmail(
      `please fail marker-fail-1 ${emailjsFailure(429)}`,
    );

    expect(response.status).toBe(429);
    expect(
      await upstreamClient(upstreams.origin).callsFor('marker-fail-1'),
    ).toHaveLength(1);
  });

  test('records a Turnstile call as its form fields', async () => {
    await postTurnstile(turnstileToken('pass', 'marker-ts-1'));

    const calls = await upstreamClient(upstreams.origin).callsFor(
      'marker-ts-1',
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      upstream: 'turnstile',
      method: 'POST',
      path: TURNSTILE_PATH,
      body: {
        secret: 'secret',
        response: 'pass:marker-ts-1',
        remoteip: '2001:db8::1',
      },
    });
  });

  const scenarios: [
    scenario: Parameters<typeof turnstileToken>[0],
    status: number,
    answer: Record<string, unknown> | undefined,
  ][] = [
    ['pass', 200, { success: true }],
    [
      'refuse',
      200,
      { success: false, 'error-codes': ['invalid-input-response'] },
    ],
    [
      'duplicate',
      200,
      { success: false, 'error-codes': ['timeout-or-duplicate'] },
    ],
    ['fault', 200, { success: false, 'error-codes': ['invalid-input-secret'] }],
    [
      'unknown-code',
      200,
      { success: false, 'error-codes': ['e2e-unknown-code'] },
    ],
    ['http-500', 500, undefined],
  ];

  for (const [scenario, status, answer] of scenarios) {
    test(`answers a ${scenario} token the way Turnstile would`, async () => {
      const response = await postTurnstile(
        turnstileToken(scenario, `marker-scenario-${scenario}`),
      );

      expect(response.status).toBe(status);
      if (answer !== undefined) {
        expect(await response.json()).toMatchObject(answer);
      }
    });
  }

  test('refuses a token it does not recognize instead of letting it pass', async () => {
    for (const token of ['', 'whatever', 'passs:x', 'XXXX.DUMMY.TOKEN.XXXX']) {
      const response = await postTurnstile(token);

      expect(await response.json()).toMatchObject({ success: false });
    }
  });

  test('records a request to any other path as unexpected, and answers 404', async () => {
    const response = await fetch(`${upstreams.origin}/somewhere/else`, {
      method: 'POST',
      body: 'marker-stray-1',
    });

    expect(response.status).toBe(404);
    const unexpected = await upstreamClient(upstreams.origin).unexpectedCalls();
    expect(unexpected.map((call) => call.path)).toContain('/somewhere/else');
  });

  test('refuses to start on a port that is already in use', async () => {
    const port = Number(new URL(upstreams.origin).port);

    await expect(startFakeUpstreams({ port })).rejects.toThrow(
      /already in use|EADDRINUSE/,
    );
  });
});

test.describe('the site key the running server renders', () => {
  const widget = (key: string) =>
    `<div class="cf-turnstile" data-sitekey="${key}" data-size="flexible"></div>`;

  test('is read from the widget on the contact page', () => {
    expect(
      renderedSiteKey(`<form>${widget('1x00000000000000000000BB')}</form>`),
    ).toBe('1x00000000000000000000BB');
  });

  test('is nothing when the page has no widget', () => {
    expect(
      renderedSiteKey('<h1>The form is not available right now</h1>'),
    ).toBe(undefined);
  });

  test('is no problem when it is the key of .dev.vars.e2e', () => {
    expect(
      siteKeyProblems(
        widget('1x00000000000000000000BB'),
        '1x00000000000000000000BB',
      ),
    ).toEqual([]);
  });

  test('is a problem when it is another key: the server read other settings', () => {
    const problems = siteKeyProblems(
      widget('1x00000000000000000000AA'),
      '1x00000000000000000000BB',
    ).join('\n');

    expect(problems).toContain('TURNSTILE_SITE_KEY');
    expect(problems).toContain('.dev.vars.e2e');
  });

  test('is a problem when there is no widget: the server has no complete settings', () => {
    expect(
      siteKeyProblems(
        '<h1>The form is not available right now</h1>',
        '1x00000000000000000000BB',
      ).join('\n'),
    ).toMatch(/no widget|not configured|settings/i);
  });
});

test.describe('assertServerReadsE2eSettings', () => {
  let server: Server;
  let origin = '';
  let answer: { status: number; body: string } = { status: 200, body: '' };

  test.beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(answer.status, { 'content-type': 'text/html' });
      response.end(answer.body);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const expected = '1x00000000000000000000BB';

  test('passes when the contact page renders the key of the e2e settings', async () => {
    answer = {
      status: 200,
      body: `<div class="cf-turnstile" data-sitekey="${expected}"></div>`,
    };

    await expect(
      assertServerReadsE2eSettings(origin, expected),
    ).resolves.toBeUndefined();
  });

  test('stops the run when the page renders another key', async () => {
    answer = {
      status: 200,
      body: '<div class="cf-turnstile" data-sitekey="1x00000000000000000000AA"></div>',
    };

    await expect(
      assertServerReadsE2eSettings(origin, expected),
    ).rejects.toThrow(/not hermetic[\s\S]*TURNSTILE_SITE_KEY/);
  });

  test('stops the run when the page is not served', async () => {
    answer = { status: 500, body: 'boom' };

    await expect(
      assertServerReadsE2eSettings(origin, expected),
    ).rejects.toThrow(/500/);
  });

  test('stops the run when nobody answers', async () => {
    await expect(
      assertServerReadsE2eSettings('http://127.0.0.1:1', expected),
    ).rejects.toThrow(/could not be reached|ECONNREFUSED|fetch failed/i);
  });

  test('asks for the page once and sends nothing but a GET', async () => {
    const seen: string[] = [];
    const probe = createServer((request, response) => {
      seen.push(`${request.method} ${request.url}`);
      response.end(`<div data-sitekey="${expected}"></div>`);
    });
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const probeOrigin = `http://127.0.0.1:${(probe.address() as AddressInfo).port}`;

    await assertServerReadsE2eSettings(probeOrigin, expected);
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    expect(seen).toEqual(['GET /contact/']);
  });
});

test.describe('waitForRateLimitWindow', () => {
  // Miniflare's local rate limiter counts in fixed windows aligned to the wall clock (the
  // window of `now` is `floor(now / period)`), so a burst that straddles a minute boundary
  // starts over in the middle of it: four posts in a row can all be let through. A test that
  // needs the fourth refused first waits for a window with enough of its minute left.
  const MINUTE = 60_000;

  test('does not wait when enough of the minute is left', async () => {
    const slept: number[] = [];

    await waitForRateLimitWindow(15_000, {
      now: () => 10 * MINUTE + 20_000,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });

    expect(slept).toEqual([]);
  });

  test('waits for the next window, and a little longer, when too little of the minute is left', async () => {
    const slept: number[] = [];

    await waitForRateLimitWindow(15_000, {
      now: () => 10 * MINUTE + 50_000,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });

    // 10 s left in this window: sleep through them and past the boundary.
    expect(slept).toHaveLength(1);
    expect(slept[0]).toBeGreaterThanOrEqual(10_000);
    expect(slept[0]).toBeLessThan(11_000);
  });

  test('treats the last instant of a window like any other late moment', async () => {
    const slept: number[] = [];

    await waitForRateLimitWindow(15_000, {
      now: () => 10 * MINUTE + 59_999,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });

    expect(slept).toHaveLength(1);
    expect(slept[0]).toBeGreaterThanOrEqual(1);
    expect(slept[0]).toBeLessThan(1_000);
  });

  test('does not wait at the very start of a window', async () => {
    const slept: number[] = [];

    await waitForRateLimitWindow(15_000, {
      now: () => 10 * MINUTE,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });

    expect(slept).toEqual([]);
  });
});

test.describe('retryOnProxyFailure', () => {
  // The preview proxy sometimes fails a post the Worker refuses from its headers alone (see
  // contact-test.ts), and the retry hides that from the test that made it. So a retry must
  // leave a trace of its own: an annotation on the test and a warning on the console.
  type Answer = number | 'reset';

  /**
   * A server on a port of its own that answers its requests as `script` says, one answer
   * for each request and a 200 after the last: a number is the status, `'reset'` closes the
   * connection with no answer, the way the proxy fails.
   */
  async function serving(script: readonly Answer[]) {
    let requests = 0;
    const server = createServer((request, response) => {
      const answer = script[requests] ?? 200;
      requests += 1;
      if (answer === 'reset') {
        request.socket.destroy();
        return;
      }
      response.writeHead(answer).end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );

    return {
      url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
      requests: () => requests,
      close: () =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        }),
    };
  }

  /**
   * Runs `retryOnProxyFailure` on a GET of a server that answers as `script` says, and
   * reports what came of it: the final status, how many requests the server saw, and the
   * warnings the retries wrote to the console.
   */
  async function runAgainst(request: APIRequestContext, script: Answer[]) {
    const server = await serving(script);
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (message: unknown) => {
      warnings.push(String(message));
    };

    try {
      const response = await retryOnProxyFailure(() => request.get(server.url));
      return {
        status: response.status(),
        requests: server.requests(),
        warnings,
      };
    } finally {
      console.warn = warn;
      await server.close();
    }
  }

  test('leaves one annotation and one warning for a request that fails once and then succeeds', async ({
    request,
  }) => {
    const outcome = await runAgainst(request, [500]);

    expect(outcome).toEqual({
      status: 200,
      requests: 2,
      warnings: [
        'retryOnProxyFailure: attempt 1 of 5 failed: HTTP 500; trying again',
      ],
    });
    expect(test.info().annotations).toEqual([
      { type: 'proxy-retry', description: 'attempt 1 of 5 failed: HTTP 500' },
    ]);
  });

  test('names the keyword of the error when the connection is reset', async ({
    request,
  }) => {
    const outcome = await runAgainst(request, ['reset']);

    expect(outcome).toMatchObject({ status: 200, requests: 2 });
    expect(outcome.warnings).toHaveLength(1);
    expect(test.info().annotations).toHaveLength(1);
    expect(test.info().annotations[0]).toMatchObject({
      type: 'proxy-retry',
      description: expect.stringMatching(
        /^attempt 1 of 5 failed: (socket hang up|ECONNRESET)$/i,
      ),
    });
  });

  test('leaves one annotation for each retried attempt, and returns the last answer when every attempt fails', async ({
    request,
  }) => {
    const outcome = await runAgainst(request, [500, 500, 500, 500, 500]);

    expect(outcome).toMatchObject({ status: 500, requests: 5 });
    // The fifth attempt is not retried, so it leaves none: its answer is what fails the test.
    expect(
      test.info().annotations.map((annotation) => annotation.description),
    ).toEqual([
      'attempt 1 of 5 failed: HTTP 500',
      'attempt 2 of 5 failed: HTTP 500',
      'attempt 3 of 5 failed: HTTP 500',
      'attempt 4 of 5 failed: HTTP 500',
    ]);
  });

  test('leaves nothing for an answer it does not retry', async ({
    request,
  }) => {
    const outcome = await runAgainst(request, [413]);

    expect(outcome).toEqual({ status: 413, requests: 1, warnings: [] });
    expect(test.info().annotations).toEqual([]);
  });
});

// A `.dev.vars` file as the Cloudflare plugin bakes it into the build: every value quoted.
function baked(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([name, value]) => `${name}='${value}'\n`)
    .join('');
}

const E2E_VARS: Record<string, string> = {
  TURNSTILE_SITE_KEY: '1x00000000000000000000BB',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  EMAILJS_SERVICE_ID: 'e2e-service-id',
  EMAILJS_TEMPLATE_ID: 'e2e-template-id',
  EMAILJS_PUBLIC_KEY: 'e2e-public-key',
  EMAILJS_PRIVATE_KEY: 'e2e-private-key',
  EMAILJS_API_URL: `${UPSTREAM_ORIGIN}${EMAILJS_PATH}`,
  TURNSTILE_VERIFY_URL: `${UPSTREAM_ORIGIN}${TURNSTILE_PATH}`,
};

test.describe('parseDevVars', () => {
  test('reads plain, quoted, commented and blank lines like wrangler does', () => {
    const parsed = parseDevVars(
      [
        '# a comment',
        '',
        'PLAIN=value',
        "SINGLE='quoted value'",
        'DOUBLE="double quoted"',
        'TICKS=`back ticks`',
        'EMPTY=',
        'URL=http://127.0.0.1:4332/a?b=c',
      ].join('\n'),
    );

    expect(parsed).toEqual({
      PLAIN: 'value',
      SINGLE: 'quoted value',
      DOUBLE: 'double quoted',
      TICKS: 'back ticks',
      EMPTY: '',
      URL: 'http://127.0.0.1:4332/a?b=c',
    });
  });

  test('reads what the plugin bakes back to the values that went in', () => {
    expect(parseDevVars(baked(E2E_VARS))).toEqual(E2E_VARS);
  });

  test('ignores Windows line endings', () => {
    expect(parseDevVars('A=1\r\nB=2\r\n')).toEqual({ A: '1', B: '2' });
  });
});

/** The settings without `name`. */
function without(
  vars: Record<string, string>,
  name: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars).filter(([key]) => key !== name),
  );
}

test.describe('e2eVarsProblems: the committed .dev.vars.e2e', () => {
  test('accepts the settings the tests are meant to run with', () => {
    expect(e2eVarsProblems(E2E_VARS)).toEqual([]);
  });

  test('names a missing setting', () => {
    expect(
      e2eVarsProblems(without(E2E_VARS, 'EMAILJS_PRIVATE_KEY')).join('\n'),
    ).toContain('EMAILJS_PRIVATE_KEY');
  });

  test('names a setting nobody asked for', () => {
    expect(
      e2eVarsProblems({ ...E2E_VARS, SOMETHING_ELSE: 'x' }).join('\n'),
    ).toContain('SOMETHING_ELSE');
  });

  test('refuses a Turnstile secret key that is not one of Cloudflare’s published test keys', () => {
    const problems = e2eVarsProblems({
      ...E2E_VARS,
      TURNSTILE_SECRET_KEY: '0x4AAAAAAAreal-looking-secret',
    });

    expect(problems.join('\n')).toContain('TURNSTILE_SECRET_KEY');
    expect(problems.join('\n')).not.toContain('real-looking-secret');
  });

  test('refuses a Turnstile site key that is not one of Cloudflare’s published test keys', () => {
    expect(
      e2eVarsProblems({
        ...E2E_VARS,
        TURNSTILE_SITE_KEY: '0x4AAAAAAAreal',
      }).join('\n'),
    ).toContain('TURNSTILE_SITE_KEY');
  });

  for (const name of [
    'EMAILJS_SERVICE_ID',
    'EMAILJS_TEMPLATE_ID',
    'EMAILJS_PUBLIC_KEY',
    'EMAILJS_PRIVATE_KEY',
  ]) {
    test(`refuses a ${name} that does not start with e2e-, so it cannot be a real one`, () => {
      const problems = e2eVarsProblems({ ...E2E_VARS, [name]: 'abc123' });

      expect(problems.join('\n')).toContain(name);
      expect(problems.join('\n')).not.toContain('abc123');
    });
  }

  for (const name of ['EMAILJS_API_URL', 'TURNSTILE_VERIFY_URL']) {
    test(`refuses a ${name} that does not point at the fake upstreams`, () => {
      const problems = e2eVarsProblems({
        ...E2E_VARS,
        [name]: 'https://api.emailjs.com/api/v1.0/email/send',
      });

      expect(problems.join('\n')).toContain(name);
    });

    test(`refuses a missing ${name}, since the real endpoint would answer instead`, () => {
      expect(e2eVarsProblems(without(E2E_VARS, name)).join('\n')).toContain(
        name,
      );
    });
  }
});

test.describe('buildOutputProblems: the build the server runs', () => {
  const madeForE2e = { targetEnvironment: 'e2e' };

  test('accepts a build made with CLOUDFLARE_ENV=e2e that baked the e2e settings', () => {
    expect(
      buildOutputProblems({
        wranglerJson: madeForE2e,
        bakedVars: E2E_VARS,
        e2eVars: E2E_VARS,
      }),
    ).toEqual([]);
  });

  test('says the build is missing when there is no wrangler.json', () => {
    expect(
      buildOutputProblems({
        wranglerJson: undefined,
        bakedVars: undefined,
        e2eVars: E2E_VARS,
      }).join('\n'),
    ).toMatch(/wrangler\.json.*missing/i);
  });

  test('refuses a build made without CLOUDFLARE_ENV=e2e', () => {
    const problems = buildOutputProblems({
      wranglerJson: {},
      bakedVars: E2E_VARS,
      e2eVars: E2E_VARS,
    });

    expect(problems.join('\n')).toContain('CLOUDFLARE_ENV=e2e');
  });

  test('refuses a build made for another environment', () => {
    expect(
      buildOutputProblems({
        wranglerJson: { targetEnvironment: 'staging' },
        bakedVars: E2E_VARS,
        e2eVars: E2E_VARS,
      }).join('\n'),
    ).toContain('CLOUDFLARE_ENV=e2e');
  });

  test('says the baked settings are missing when the build has none', () => {
    expect(
      buildOutputProblems({
        wranglerJson: madeForE2e,
        bakedVars: undefined,
        e2eVars: E2E_VARS,
      }).join('\n'),
    ).toMatch(/\.dev\.vars.*missing/i);
  });

  test('names the settings a developer’s .dev.vars added, and never prints a value', () => {
    const problems = buildOutputProblems({
      wranglerJson: madeForE2e,
      bakedVars: { ...E2E_VARS, SENTINEL_DEV_VARS: 'sentinel-secret-value' },
      e2eVars: E2E_VARS,
    }).join('\n');

    expect(problems).toContain('SENTINEL_DEV_VARS');
    expect(problems).not.toContain('sentinel-secret-value');
  });

  test('names a setting whose value differs, and prints neither value', () => {
    const problems = buildOutputProblems({
      wranglerJson: madeForE2e,
      bakedVars: { ...E2E_VARS, EMAILJS_PRIVATE_KEY: 'a-real-private-key' },
      e2eVars: E2E_VARS,
    }).join('\n');

    expect(problems).toContain('EMAILJS_PRIVATE_KEY');
    expect(problems).not.toContain('a-real-private-key');
    expect(problems).not.toContain('e2e-private-key');
  });

  test('names a setting the build lost', () => {
    expect(
      buildOutputProblems({
        wranglerJson: madeForE2e,
        bakedVars: without(E2E_VARS, 'TURNSTILE_VERIFY_URL'),
        e2eVars: E2E_VARS,
      }).join('\n'),
    ).toContain('TURNSTILE_VERIFY_URL');
  });
});

test.describe('assertHermeticBuild: reading the files', () => {
  let root: string;

  test.beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'hermetic-guard-'));
    mkdirSync(path.join(root, 'dist', 'server'), { recursive: true });
  });

  test.afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const lay = (files: {
    e2eVars?: string;
    wranglerJson?: string;
    bakedVars?: string;
  }) => {
    if (files.e2eVars !== undefined) {
      writeFileSync(path.join(root, '.dev.vars.e2e'), files.e2eVars);
    }
    if (files.wranglerJson !== undefined) {
      writeFileSync(
        path.join(root, 'dist', 'server', 'wrangler.json'),
        files.wranglerJson,
      );
    }
    if (files.bakedVars !== undefined) {
      writeFileSync(
        path.join(root, 'dist', 'server', '.dev.vars'),
        files.bakedVars,
      );
    }
  };

  const plain = Object.entries(E2E_VARS)
    .map(([name, value]) => `${name}=${value}\n`)
    .join('');

  test('passes for the e2e file and a build made for it', () => {
    lay({
      e2eVars: plain,
      wranglerJson: JSON.stringify({ targetEnvironment: 'e2e' }),
      bakedVars: baked(E2E_VARS),
    });

    expect(() => assertHermeticBuild(root)).not.toThrow();
  });

  test('throws once, listing every problem, for a build made without the variable', () => {
    lay({
      e2eVars: plain,
      wranglerJson: JSON.stringify({}),
      bakedVars: baked({ SENTINEL_DEV_VARS: 'sentinel-secret-value' }),
    });

    let message = '';
    try {
      assertHermeticBuild(root);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('CLOUDFLARE_ENV=e2e');
    expect(message).toContain('SENTINEL_DEV_VARS');
    expect(message).not.toContain('sentinel-secret-value');
  });

  test('throws when there is no .dev.vars.e2e', () => {
    lay({
      wranglerJson: JSON.stringify({ targetEnvironment: 'e2e' }),
      bakedVars: baked(E2E_VARS),
    });

    expect(() => assertHermeticBuild(root)).toThrow(/\.dev\.vars\.e2e/);
  });

  test('throws when wrangler.json is not JSON', () => {
    lay({
      e2eVars: plain,
      wranglerJson: '{ not json',
      bakedVars: baked(E2E_VARS),
    });

    expect(() => assertHermeticBuild(root)).toThrow(/wrangler\.json/);
  });

  test('throws when the build was never made', () => {
    lay({ e2eVars: plain });

    expect(() => assertHermeticBuild(root)).toThrow(/build/i);
  });
});
