import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { submitContact } from '../domain/submit-contact';
import { contactSchema } from '../schema';
import { createContactDeps } from './create-contact-deps';
import type { Fetch } from './outbound';
import { forbidRealFetch, spyOnConsole } from './testing';
import type { RateLimitBinding } from './workers-rate-limiter';

// Every test injects a fake `fetch` and a fake rate-limit binding. Nothing here reaches
// EmailJS, Turnstile or Cloudflare.

const TURNSTILE_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send';

const REQUIRED = [
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_PRIVATE_KEY',
];

/** A value nobody would write by hand, so finding it in a result proves a value leaked. */
const SENTINEL = 'sentinel-7f3a9c-never-print-me';

const SETTINGS = {
  TURNSTILE_SITE_KEY: 'site-key-public-1',
  TURNSTILE_SECRET_KEY: 'turnstile-secret-sentinel-2',
  EMAILJS_SERVICE_ID: 'service-id-sentinel-3',
  EMAILJS_TEMPLATE_ID: 'template-id-sentinel-4',
  EMAILJS_PUBLIC_KEY: 'public-key-sentinel-5',
  EMAILJS_PRIVATE_KEY: 'private-key-sentinel-6',
};

let consoleSpies: ReturnType<typeof spyOnConsole>;

beforeEach(() => {
  forbidRealFetch();
  consoleSpies = spyOnConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A binding that lets every key through. */
function openBinding() {
  return {
    limit: vi.fn<RateLimitBinding['limit']>(async () => ({ success: true })),
  };
}

/** The environment a Worker would have: the six settings and the limiter binding. */
function completeEnv(overrides: Record<string, unknown> = {}) {
  return {
    ...SETTINGS,
    CONTACT_RATE_LIMIT: openBinding(),
    ...overrides,
  };
}

function without(env: Record<string, unknown>, name: string) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => key !== name),
  );
}

/** Turnstile and EmailJS as they answer when all is well, routed by URL. */
function providers(
  answers: {
    turnstile?: () => Promise<Response>;
    emailjs?: () => Promise<Response>;
  } = {},
) {
  return vi.fn<Fetch>(async (url) => {
    if (url === TURNSTILE_URL) {
      return answers.turnstile
        ? answers.turnstile()
        : new Response(
            JSON.stringify({
              success: true,
              hostname: 'carlos15erh.workers.dev',
            }),
            {
              status: 200,
            },
          );
    }
    if (url === EMAILJS_URL) {
      return answers.emailjs
        ? answers.emailjs()
        : new Response('OK', { status: 200 });
    }
    throw new Error(`The test did not expect a request to ${url}`);
  });
}

/** What the wired adapters were asked, in order: which provider, never the details. */
function requestedUrls(fetchFake: ReturnType<typeof providers>) {
  return fetchFake.mock.calls.map(([url]) => url);
}

function succeeded(env: unknown, fetchImpl?: Fetch) {
  const result = createContactDeps(env, fetchImpl);
  if (!result.ok) {
    throw new Error(
      `Expected the contact dependencies to be created: ${JSON.stringify(result)}`,
    );
  }
  return result;
}

function failed(env: unknown) {
  const result = createContactDeps(env);
  if (result.ok) {
    throw new Error('Expected the contact dependencies to be refused.');
  }
  return result;
}

describe('createContactDeps: a complete environment', () => {
  it('returns the three dependencies and the Turnstile site key', () => {
    const result = succeeded(completeEnv(), providers());

    expect(result.ok).toBe(true);
    expect(Object.keys(result).sort()).toEqual(['deps', 'ok', 'siteKey']);
    expect(Object.keys(result.deps).sort()).toEqual([
      'emailSender',
      'rateLimiter',
      'verifyTurnstile',
    ]);
    expect(result.siteKey).toBe('site-key-public-1');
  });

  it('trims the site key like every other setting', () => {
    const result = succeeded(
      completeEnv({ TURNSTILE_SITE_KEY: '  site-key-public-1\n' }),
      providers(),
    );

    expect(result.siteKey).toBe('site-key-public-1');
  });

  it('ignores every entry that is not a contact setting or the limiter', () => {
    const result = succeeded(
      completeEnv({ CV_BUCKET: { get: () => null }, ASSETS: {}, OTHER: 1 }),
      providers(),
    );

    expect(Object.keys(result).sort()).toEqual(['deps', 'ok', 'siteKey']);
  });
});

describe('createContactDeps: what each dependency is wired to', () => {
  it('sends a message through EmailJS with the EmailJS settings, and never the Turnstile secret', async () => {
    const fetchFake = providers();
    const { deps } = succeeded(completeEnv(), fetchFake);

    await deps.emailSender.send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'Hello there.',
      locale: 'en',
    });

    expect(fetchFake).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFake.mock.calls[0];
    expect(url).toBe(EMAILJS_URL);
    expect(JSON.parse(String(init.body))).toEqual({
      service_id: 'service-id-sentinel-3',
      template_id: 'template-id-sentinel-4',
      user_id: 'public-key-sentinel-5',
      accessToken: 'private-key-sentinel-6',
      template_params: {
        from_name: 'Ada Lovelace',
        reply_to: 'ada@example.com',
        message: 'Hello there.',
        locale: 'en',
      },
    });
    expect(String(init.body)).not.toContain('turnstile-secret-sentinel-2');
  });

  it('verifies a token through Turnstile with the Turnstile secret, and never an EmailJS key', async () => {
    const fetchFake = providers();
    const { deps } = succeeded(completeEnv(), fetchFake);

    await expect(
      deps.verifyTurnstile('token-abc', '203.0.113.7'),
    ).resolves.toBe(true);

    expect(fetchFake).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFake.mock.calls[0];
    expect(url).toBe(TURNSTILE_URL);
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      secret: 'turnstile-secret-sentinel-2',
      response: 'token-abc',
      remoteip: '203.0.113.7',
    });
    for (const key of [
      'service-id-sentinel-3',
      'template-id-sentinel-4',
      'public-key-sentinel-5',
      'private-key-sentinel-6',
    ]) {
      expect(String(init.body)).not.toContain(key);
    }
  });

  it('counts a request in the CONTACT_RATE_LIMIT binding under the key it is given', async () => {
    const binding = openBinding();
    const { deps } = succeeded(
      completeEnv({ CONTACT_RATE_LIMIT: binding }),
      providers(),
    );

    await expect(deps.rateLimiter('203.0.113.7')).resolves.toBe(true);

    expect(binding.limit).toHaveBeenCalledTimes(1);
    expect(binding.limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
  });

  it('points EmailJS and Turnstile at their test seams when those are set', async () => {
    const fetchFake = vi.fn<Fetch>(
      async () => new Response('OK', { status: 200 }),
    );
    const { deps } = succeeded(
      completeEnv({
        EMAILJS_API_URL: 'http://127.0.0.1:4332/emailjs/send',
        TURNSTILE_VERIFY_URL: 'http://127.0.0.1:4332/turnstile/siteverify',
      }),
      fetchFake,
    );

    await deps.emailSender.send({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'Hi',
      locale: 'es',
    });
    await deps.verifyTurnstile('token-abc', undefined).catch(() => false);

    expect(fetchFake.mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:4332/emailjs/send',
      'http://127.0.0.1:4332/turnstile/siteverify',
    ]);
  });

  it('hands TURNSTILE_ALLOWED_HOSTNAMES to the Turnstile verifier', async () => {
    const answerOn = (hostname: string) => () =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true, hostname }), {
          status: 200,
        }),
      );
    const env = completeEnv({ TURNSTILE_ALLOWED_HOSTNAMES: 'example.com' });

    const { deps } = succeeded(
      env,
      providers({ turnstile: answerOn('www.example.com') }),
    );
    await expect(deps.verifyTurnstile('token-abc', undefined)).resolves.toBe(
      true,
    );

    const { deps: strict } = succeeded(
      completeEnv(),
      providers({ turnstile: answerOn('www.example.com') }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(strict.verifyTurnstile('token-abc', undefined)).resolves.toBe(
      false,
    );
  });

  it('names TURNSTILE_ALLOWED_HOSTNAMES as invalid when an entry is not a hostname', () => {
    expect(
      failed(completeEnv({ TURNSTILE_ALLOWED_HOSTNAMES: 'https://x.test' })),
    ).toEqual({
      ok: false,
      missing: [],
      invalid: ['TURNSTILE_ALLOWED_HOSTNAMES'],
    });
  });

  it('uses the global fetch, looked up when a dependency calls out, when none is given', async () => {
    const { deps } = succeeded(completeEnv());
    const stubbedFetch = providers();
    vi.stubGlobal('fetch', stubbedFetch);

    await deps.verifyTurnstile('token-abc', undefined);

    expect(requestedUrls(stubbedFetch)).toEqual([TURNSTILE_URL]);
  });

  it('builds nothing that calls out until a dependency is used', () => {
    const fetchFake = providers();

    succeeded(completeEnv(), fetchFake);

    expect(fetchFake).not.toHaveBeenCalled();
  });
});

describe('createContactDeps: an environment that cannot run the form', () => {
  it.each(REQUIRED)('names %s when it is missing', (name) => {
    expect(failed(without(completeEnv(), name))).toEqual({
      ok: false,
      missing: [name],
      invalid: [],
    });
  });

  it('names every missing setting, then the limiter, when nothing is there', () => {
    expect(failed({})).toEqual({
      ok: false,
      missing: [...REQUIRED, 'CONTACT_RATE_LIMIT'],
      invalid: [],
    });
  });

  it.each([
    ['absent', undefined],
    ['null', null],
  ])(
    'names CONTACT_RATE_LIMIT as missing when the binding is %s',
    (_label, value) => {
      expect(failed(completeEnv({ CONTACT_RATE_LIMIT: value }))).toEqual({
        ok: false,
        missing: ['CONTACT_RATE_LIMIT'],
        invalid: [],
      });
      expect(failed(without(completeEnv(), 'CONTACT_RATE_LIMIT'))).toEqual({
        ok: false,
        missing: ['CONTACT_RATE_LIMIT'],
        invalid: [],
      });
    },
  );

  it.each([
    ['a string', 'limiter'],
    ['a number', 42],
    ['true', true],
    ['an object with no limit', {}],
    ['an object whose limit is not a function', { limit: 'nope' }],
    ['an array', []],
    ['a function with no limit', () => undefined],
  ])('names CONTACT_RATE_LIMIT as invalid when it is %s', (_label, value) => {
    expect(failed(completeEnv({ CONTACT_RATE_LIMIT: value }))).toEqual({
      ok: false,
      missing: [],
      invalid: ['CONTACT_RATE_LIMIT'],
    });
  });

  it('names an invalid test seam', () => {
    expect(
      failed(
        completeEnv({ TURNSTILE_VERIFY_URL: 'http://example.com/verify' }),
      ),
    ).toEqual({ ok: false, missing: [], invalid: ['TURNSTILE_VERIFY_URL'] });
  });

  it('lists missing and invalid names together, settings first, then the limiter', () => {
    expect(
      failed({
        ...without(completeEnv(), 'EMAILJS_PRIVATE_KEY'),
        EMAILJS_API_URL: 'ftp://files.example/send',
        CONTACT_RATE_LIMIT: 'limiter',
      }),
    ).toEqual({
      ok: false,
      missing: ['EMAILJS_PRIVATE_KEY'],
      invalid: ['EMAILJS_API_URL', 'CONTACT_RATE_LIMIT'],
    });
    expect(
      failed({
        ...without(completeEnv(), 'CONTACT_RATE_LIMIT'),
        TURNSTILE_VERIFY_URL: 'ftp://files.example/verify',
        EMAILJS_SERVICE_ID: { nested: SENTINEL },
      }),
    ).toEqual({
      ok: false,
      missing: ['CONTACT_RATE_LIMIT'],
      invalid: ['EMAILJS_SERVICE_ID', 'TURNSTILE_VERIFY_URL'],
    });
  });

  it('reports a name once, however it failed', () => {
    const { missing, invalid } = failed({ CONTACT_RATE_LIMIT: 7 });

    expect(new Set([...missing, ...invalid]).size).toBe(
      missing.length + invalid.length,
    );
  });

  it('carries names and nothing else, never a value', () => {
    const result = failed({
      ...without(completeEnv(), 'TURNSTILE_SECRET_KEY'),
      EMAILJS_SERVICE_ID: { leaked: SENTINEL },
      EMAILJS_PRIVATE_KEY: `${SENTINEL}-private`,
      EMAILJS_API_URL: `http://${SENTINEL}.example.com/send`,
      CONTACT_RATE_LIMIT: { limit: SENTINEL, secret: SENTINEL },
    });

    expect(Object.keys(result)).toEqual(['ok', 'missing', 'invalid']);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
    expect(JSON.stringify(result)).not.toContain('sentinel-');
  });

  it.each([[undefined], [null], ['a string'], [42], [[]], [() => undefined]])(
    'does not throw for %j instead of an environment',
    (env) => {
      expect(failed(env)).toEqual({
        ok: false,
        missing: [...REQUIRED, 'CONTACT_RATE_LIMIT'],
        invalid: [],
      });
    },
  );

  it('does not throw when reading the environment does', () => {
    const hostile = completeEnv();
    Object.defineProperty(hostile, 'CONTACT_RATE_LIMIT', {
      enumerable: true,
      get() {
        throw new Error(`reading failed ${SENTINEL}`);
      },
    });
    Object.defineProperty(hostile, 'EMAILJS_PRIVATE_KEY', {
      enumerable: true,
      get() {
        throw new Error(`reading failed ${SENTINEL}`);
      },
    });

    // What could not be read is named as missing, and nothing the error said travels.
    const result = failed(hostile);

    expect(result).toEqual({
      ok: false,
      missing: ['EMAILJS_PRIVATE_KEY', 'CONTACT_RATE_LIMIT'],
      invalid: [],
    });
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('reads each entry of the environment once', () => {
    const reads: string[] = [];
    const counted = new Proxy(completeEnv(), {
      get(target, name, receiver) {
        reads.push(String(name));
        return Reflect.get(target, name, receiver);
      },
    });

    succeeded(counted, providers());

    for (const name of [...REQUIRED, 'CONTACT_RATE_LIMIT']) {
      expect(reads.filter((read) => read === name)).toHaveLength(1);
    }
  });

  it('logs nothing: the composition root decides what to say about a failure', () => {
    failed({});
    failed(completeEnv({ CONTACT_RATE_LIMIT: 7 }));
    succeeded(completeEnv(), providers());

    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

// The domain decides what a failing dependency means (a limiter that cannot answer lets
// the request through, a verifier that cannot answer fails it) and logs one line for it:
// fixed text, plus at most a closed suffix. The adapters only reject, so each failure must
// be reported exactly once.
describe('createContactDeps: the wired dependencies inside submitContact', () => {
  const CLIENT_IP = '203.0.113.7';

  // The lines `submitContact` logs for a failed verifier and sender. A failure that carries
  // a detail ends its line with it, in brackets: the provider's HTTP status, or the fault
  // code of a Turnstile answer that blames the secret or the request. An answer with a code
  // the Worker does not know carries no detail.
  const VERIFIER_LINE =
    'contact: the Turnstile verifier failed, so the submission was rejected';
  const SENDER_LINE = 'contact: the email sender failed';

  function submission() {
    return contactSchema.parse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'Hello there.',
      locale: 'en',
      'cf-turnstile-response': 'token-abc',
    });
  }

  const context = () => ({
    request: new Request('https://example.com/contact', {
      method: 'POST',
      headers: { 'cf-connecting-ip': CLIENT_IP },
    }),
  });

  async function run(env: unknown, fetchFake: ReturnType<typeof providers>) {
    const { deps } = succeeded(env, fetchFake);
    return submitContact(submission(), deps, context());
  }

  /** Every console call as its text, whatever the method. */
  function logged() {
    return consoleSpies.flatMap((spy) =>
      spy.mock.calls.map((call) => call.join(' ')),
    );
  }

  it('delivers a message that passes the limiter and Turnstile, and logs nothing', async () => {
    const fetchFake = providers();

    const outcome = await run(completeEnv(), fetchFake);

    expect(outcome).toEqual({ kind: 'sent' });
    expect(requestedUrls(fetchFake)).toEqual([TURNSTILE_URL, EMAILJS_URL]);
    expect(logged()).toEqual([]);
  });

  it('stops at the limiter when the binding says the key used up its budget', async () => {
    const fetchFake = providers();
    const binding = {
      limit: vi.fn<RateLimitBinding['limit']>(async () => ({ success: false })),
    };

    const outcome = await run(
      completeEnv({ CONTACT_RATE_LIMIT: binding }),
      fetchFake,
    );

    expect(outcome).toEqual({ kind: 'rate_limited' });
    expect(binding.limit).toHaveBeenCalledWith({ key: CLIENT_IP });
    expect(fetchFake).not.toHaveBeenCalled();
    expect(logged()).toEqual([]);
  });

  it.each([
    [
      'rejects',
      () =>
        vi.fn<RateLimitBinding['limit']>(async () => {
          throw new Error(`binding detail ${SENTINEL}`);
        }),
    ],
    [
      'throws',
      () =>
        vi.fn<RateLimitBinding['limit']>(() => {
          throw new Error(`binding detail ${SENTINEL}`);
        }),
    ],
    [
      'answers something unexpected',
      () =>
        vi.fn(async () => ({
          allowed: true,
        })) as unknown as RateLimitBinding['limit'],
    ],
  ])(
    'lets the request through, and logs one warning in total, when the binding %s',
    async (_label, makeLimit) => {
      const fetchFake = providers();

      const outcome = await run(
        completeEnv({ CONTACT_RATE_LIMIT: { limit: makeLimit() } }),
        fetchFake,
      );

      expect(outcome).toEqual({ kind: 'sent' });
      expect(requestedUrls(fetchFake)).toEqual([TURNSTILE_URL, EMAILJS_URL]);
      expect(vi.mocked(console.warn)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(console.error)).not.toHaveBeenCalled();
      expect(consoleSpies.flatMap((spy) => spy.mock.calls)).toHaveLength(1);
      expect(logged().join('\n')).not.toContain(SENTINEL);
    },
  );

  /** Turnstile answering 200 with `success: false` and these error codes. */
  const refusing =
    (...codes: string[]) =>
    async () =>
      new Response(JSON.stringify({ success: false, 'error-codes': codes }), {
        status: 200,
      });

  // The codes that blame the visitor's token are an ordinary "no": nothing to log.
  it.each([
    'missing-input-response',
    'invalid-input-response',
    'timeout-or-duplicate',
  ])(
    'fails the submission without sending when Turnstile rejects the token (%s), and logs nothing',
    async (code) => {
      const fetchFake = providers({ turnstile: refusing(code) });

      const outcome = await run(completeEnv(), fetchFake);

      expect(outcome).toEqual({ kind: 'verification_failed' });
      expect(requestedUrls(fetchFake)).toEqual([TURNSTILE_URL]);
      expect(logged()).toEqual([]);
    },
  );

  // The codes that blame the secret, the request or Turnstile are a failure the owner can
  // act on, so they are logged: a wrong TURNSTILE_SECRET_KEY no longer fails in silence.
  // The token was never judged, so the visitor is told the form is unavailable, not that
  // the token was refused.
  it.each([
    'missing-input-secret',
    'invalid-input-secret',
    'bad-request',
    'internal-error',
  ])(
    'answers unavailable without sending, and logs one error ending in (%s), when Turnstile lists it',
    async (code) => {
      const fetchFake = providers({ turnstile: refusing(code) });

      const outcome = await run(completeEnv(), fetchFake);

      expect(outcome).toEqual({ kind: 'unavailable' });
      expect(requestedUrls(fetchFake)).toEqual([TURNSTILE_URL]);
      expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
      expect(consoleSpies.flatMap((spy) => spy.mock.calls)).toHaveLength(1);
      expect(logged()).toEqual([`${VERIFIER_LINE} (${code})`]);
    },
  );

  it('logs the same single code whatever order Turnstile lists several in, token codes among them', async () => {
    const fetchFake = providers({
      turnstile: refusing(
        'internal-error',
        'invalid-input-response',
        'bad-request',
        'invalid-input-secret',
      ),
    });

    const outcome = await run(completeEnv(), fetchFake);

    expect(outcome).toEqual({ kind: 'unavailable' });
    expect(logged()).toEqual([`${VERIFIER_LINE} (invalid-input-secret)`]);
  });

  // A code the Worker does not know proves nothing about the token, so the answer is neither
  // mistaken for a rejected token nor silent: the verifier line is logged, with no suffix,
  // and the code itself, which is Turnstile's text, is nowhere in it.
  it.each([
    ['only that code', [SENTINEL]],
    ['that code beside a token code', ['invalid-input-response', SENTINEL]],
  ])(
    'answers unavailable without sending, and logs the verifier line with no suffix, when Turnstile lists a code the Worker does not know (%s)',
    async (_label, codes) => {
      const fetchFake = providers({ turnstile: refusing(...codes) });

      const outcome = await run(completeEnv(), fetchFake);

      expect(outcome).toEqual({ kind: 'unavailable' });
      expect(requestedUrls(fetchFake)).toEqual([TURNSTILE_URL]);
      expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
      expect(consoleSpies.flatMap((spy) => spy.mock.calls)).toHaveLength(1);
      expect(logged()).toEqual([VERIFIER_LINE]);
      expect(logged().join('\n')).not.toContain(SENTINEL);
    },
  );

  it('logs the fault code, and not the unknown one, when Turnstile lists both', async () => {
    const fetchFake = providers({
      turnstile: refusing(SENTINEL, 'invalid-input-secret'),
    });

    const outcome = await run(completeEnv(), fetchFake);

    expect(outcome).toEqual({ kind: 'unavailable' });
    expect(logged()).toEqual([`${VERIFIER_LINE} (invalid-input-secret)`]);
    expect(logged().join('\n')).not.toContain(SENTINEL);
  });

  it.each([
    [
      'answers 500',
      () => Promise.resolve(new Response(SENTINEL, { status: 500 })),
      ' (HTTP 500)',
    ],
    [
      'answers 503',
      () => Promise.resolve(new Response(SENTINEL, { status: 503 })),
      ' (HTTP 503)',
    ],
    [
      'answers something that is not JSON',
      () => Promise.resolve(new Response(SENTINEL, { status: 200 })),
      '',
    ],
    [
      'cannot be reached',
      () => Promise.reject(new TypeError(`connect failed ${SENTINEL}`)),
      '',
    ],
    [
      'times out',
      () =>
        Promise.reject(new DOMException(`slow ${SENTINEL}`, 'TimeoutError')),
      '',
    ],
  ])(
    'answers unavailable, sends nothing, and logs one error in total, when Turnstile %s',
    async (_label, answer, suffix) => {
      const fetchFake = providers({ turnstile: answer });

      const outcome = await run(completeEnv(), fetchFake);

      expect(outcome).toEqual({ kind: 'unavailable' });
      expect(requestedUrls(fetchFake)).toEqual([TURNSTILE_URL]);
      expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
      expect(consoleSpies.flatMap((spy) => spy.mock.calls)).toHaveLength(1);
      expect(logged()).toEqual([`${VERIFIER_LINE}${suffix}`]);
      expect(logged().join('\n')).not.toContain(SENTINEL);
    },
  );

  it.each([
    [
      'answers 403',
      () => Promise.resolve(new Response(SENTINEL, { status: 403 })),
      ' (HTTP 403)',
    ],
    [
      'answers 429',
      () => Promise.resolve(new Response(SENTINEL, { status: 429 })),
      ' (HTTP 429)',
    ],
    [
      'answers 500',
      () => Promise.resolve(new Response(SENTINEL, { status: 500 })),
      ' (HTTP 500)',
    ],
    [
      'cannot be reached',
      () => Promise.reject(new TypeError(`connect failed ${SENTINEL}`)),
      '',
    ],
    [
      'times out',
      () =>
        Promise.reject(new DOMException(`slow ${SENTINEL}`, 'TimeoutError')),
      '',
    ],
  ])(
    'reports delivery_failed, and logs one error in total, when EmailJS %s',
    async (_label, answer, suffix) => {
      const fetchFake = providers({ emailjs: answer });

      const outcome = await run(completeEnv(), fetchFake);

      expect(outcome).toEqual({ kind: 'delivery_failed' });
      expect(requestedUrls(fetchFake)).toEqual([TURNSTILE_URL, EMAILJS_URL]);
      expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
      expect(consoleSpies.flatMap((spy) => spy.mock.calls)).toHaveLength(1);
      expect(logged()).toEqual([`${SENDER_LINE}${suffix}`]);
      expect(logged().join('\n')).not.toContain(SENTINEL);
    },
  );

  it('tries EmailJS once and never retries a failed delivery', async () => {
    const fetchFake = providers({
      emailjs: async () => new Response('slow down', { status: 429 }),
    });

    await run(completeEnv(), fetchFake);

    expect(
      requestedUrls(fetchFake).filter((url) => url === EMAILJS_URL),
    ).toEqual([EMAILJS_URL]);
  });

  it('keeps every key and the visitor text out of everything logged, whichever step fails', async () => {
    const leaky = () => Promise.reject(new Error(JSON.stringify(SETTINGS)));
    const visitor = ['Ada Lovelace', 'ada@example.com', 'Hello there.'];

    // A status answer whose body quotes every setting: the status is logged, the body is not.
    const quoting = (status: number) => () =>
      Promise.resolve(
        new Response(JSON.stringify(SETTINGS), {
          status,
        }),
      );

    await run(completeEnv(), providers({ turnstile: leaky }));
    await run(completeEnv(), providers({ emailjs: leaky }));
    await run(completeEnv(), providers({ turnstile: quoting(503) }));
    await run(completeEnv(), providers({ emailjs: quoting(403) }));
    // A fault code whose answer quotes every setting: the code is logged, the answer is not.
    await run(
      completeEnv(),
      providers({
        turnstile: async () =>
          new Response(
            JSON.stringify({
              success: false,
              'error-codes': ['invalid-input-secret'],
              echo: SETTINGS,
            }),
            { status: 200 },
          ),
      }),
    );
    // An unknown code that quotes every setting: the line is logged, the code is not.
    await run(
      completeEnv(),
      providers({ turnstile: refusing(JSON.stringify(SETTINGS)) }),
    );
    await run(
      completeEnv({
        CONTACT_RATE_LIMIT: {
          limit: async () => {
            throw new Error(JSON.stringify(SETTINGS));
          },
        },
      }),
      providers(),
    );

    const everything = logged().join('\n');
    expect(everything).not.toBe('');
    for (const secret of [...Object.values(SETTINGS), ...visitor, CLIENT_IP]) {
      expect(everything).not.toContain(secret);
    }
  });
});
