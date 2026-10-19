import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderFailure, failureSuffix } from '../provider-failure';
import type { Fetch } from './outbound';
import { createTurnstileVerifier } from './turnstile-verifier';
import {
  everythingAbout,
  forbidRealFetch,
  rejectionOf,
  spyOnConsole,
} from './testing';

// Every test injects a fake `fetch`. Nothing here reaches Turnstile or any network.

const CONFIG = {
  secretKey: 'secret-key-sentinel-1',
  verifyUrl: undefined,
  allowedHostnames: [] as readonly string[],
};
const TOKEN = 'token-sentinel-2.AbC-123_xyz';
const CLIENT_IP = '203.0.113.7';

const ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** What the provider's own error could quote back: the secret, the token, the IP, its body. */
const LEAKY_TEXT =
  'secret=secret-key-sentinel-1 response=token-sentinel-2.AbC-123_xyz ip=203.0.113.7 body=PROVIDER-BODY-SENTINEL';

let consoleSpies: ReturnType<typeof spyOnConsole>;

beforeEach(() => {
  forbidRealFetch();
  consoleSpies = spyOnConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A fake `fetch` that answers with `response` (or whatever the function returns). */
function fetchAnswering(response: Response | (() => Promise<Response>)) {
  return vi.fn<Fetch>(async () =>
    response instanceof Response ? response : response(),
  );
}

/** Turnstile answering with this JSON; it answers 200 for a pass and for a fail alike. */
function jsonAnswer(body: unknown, status = 200) {
  // A 204, 205 or 304 response cannot have a body.
  const bodiless = [204, 205, 304].includes(status);

  return new Response(bodiless ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** The documented shape of a successful answer. */
const passed = () =>
  jsonAnswer({
    success: true,
    challenge_ts: '2026-09-30T12:00:00.000Z',
    hostname: 'carlos15erh.workers.dev',
    'error-codes': [],
    action: '',
    cdata: '',
    metadata: { ephemeral_id: 'not-enterprise' },
  });

/** Asks the verifier about the answer a fake Turnstile gives. */
const verifyAnswer = (response: Response) =>
  createTurnstileVerifier(CONFIG, fetchAnswering(response))(TOKEN, CLIENT_IP);

/** A 200 that says `success: false` and lists these error codes, plus any other fields. */
const failed = (errorCodes: unknown, rest: Record<string, unknown> = {}) =>
  jsonAnswer({ success: false, 'error-codes': errorCodes, ...rest });

/** The request `fetch` received, taken apart. */
function sentRequest(fetchFake: ReturnType<typeof fetchAnswering>) {
  expect(fetchFake).toHaveBeenCalledTimes(1);
  const [url, init] = fetchFake.mock.calls[0];
  const form = new URLSearchParams(String(init.body));

  return {
    url,
    init,
    headers: Object.fromEntries(new Headers(init.headers)),
    form: Object.fromEntries(form),
    fieldNames: [...form.keys()],
  };
}

describe('createTurnstileVerifier: the request', () => {
  it('posts to the siteverify endpoint', async () => {
    const fetchFake = fetchAnswering(passed());

    await createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP);

    const { url, init } = sentRequest(fetchFake);
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
  });

  it('sends a form-encoded body and no other header, so the secret never travels in a header', async () => {
    const fetchFake = fetchAnswering(passed());

    await createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP);

    expect(sentRequest(fetchFake).headers).toEqual({
      'content-type': 'application/x-www-form-urlencoded',
    });
  });

  it('sends the secret, the token and the visitor IP, and nothing else', async () => {
    const fetchFake = fetchAnswering(passed());

    await createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP);

    const { form, fieldNames } = sentRequest(fetchFake);
    expect(form).toEqual({
      secret: 'secret-key-sentinel-1',
      response: TOKEN,
      remoteip: CLIENT_IP,
    });
    expect(fieldNames).toHaveLength(3);
  });

  it.each([[undefined], ['']])(
    'leaves remoteip out when the visitor IP is not known (%j)',
    async (remoteIp) => {
      const fetchFake = fetchAnswering(passed());

      await createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, remoteIp);

      const { form, fieldNames } = sentRequest(fetchFake);
      expect(form).toEqual({
        secret: 'secret-key-sentinel-1',
        response: TOKEN,
      });
      expect(fieldNames).toEqual(['secret', 'response']);
    },
  );

  it('passes an IPv6 address as it came', async () => {
    const fetchFake = fetchAnswering(passed());

    await createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, '2001:db8::1');

    expect(sentRequest(fetchFake).form.remoteip).toBe('2001:db8::1');
  });

  // The token is visitor-controlled text. Encoded like any value, it stays one field.
  it('cannot be made to add or override a field by a crafted token', async () => {
    const fetchFake = fetchAnswering(passed());
    const crafted =
      'x&secret=attacker-key&remoteip=198.51.100.9&idempotency_key=1';

    await createTurnstileVerifier(CONFIG, fetchFake)(crafted, CLIENT_IP);

    const { form, fieldNames } = sentRequest(fetchFake);
    expect(form.response).toBe(crafted);
    expect(form.secret).toBe('secret-key-sentinel-1');
    expect(form.remoteip).toBe(CLIENT_IP);
    expect(fieldNames).toEqual(['secret', 'response', 'remoteip']);
  });

  it('encodes reserved and non-ASCII characters so the token arrives unchanged', async () => {
    const fetchFake = fetchAnswering(passed());
    const token = 'a b+c%d=e;f/g?h#i é 李 🙂';

    await createTurnstileVerifier(CONFIG, fetchFake)(token, CLIENT_IP);

    expect(sentRequest(fetchFake).form.response).toBe(token);
  });

  it('posts to the verifyUrl seam instead when one is set', async () => {
    const fetchFake = fetchAnswering(passed());

    await createTurnstileVerifier(
      { ...CONFIG, verifyUrl: 'http://127.0.0.1:4332/turnstile/siteverify' },
      fetchFake,
    )(TOKEN, CLIENT_IP);

    expect(sentRequest(fetchFake).url).toBe(
      'http://127.0.0.1:4332/turnstile/siteverify',
    );
  });

  it('gives the request AbortSignal.timeout(8000)', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetchFake = fetchAnswering(passed());

    await createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP);

    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(8000);
    expect(sentRequest(fetchFake).init.signal).toBe(
      timeout.mock.results[0].value,
    );
  });

  it('does not follow a redirect, which could turn the POST into a GET that answers 200', async () => {
    const fetchFake = fetchAnswering(passed());

    await createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP);

    expect(sentRequest(fetchFake).init.redirect).toBe('manual');
  });

  it('asks once per verification and does not send an idempotency key to retry with', async () => {
    const fetchFake = fetchAnswering(() => Promise.resolve(passed()));
    const verify = createTurnstileVerifier(CONFIG, fetchFake);

    await verify(TOKEN, CLIENT_IP);
    await verify(TOKEN, CLIENT_IP);

    expect(fetchFake).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchFake.mock.calls) {
      expect(String(init.body)).not.toContain('idempotency_key');
    }
  });

  it('uses the global fetch, looked up when it verifies, when none is injected', async () => {
    const verify = createTurnstileVerifier(CONFIG);
    const stubbedFetch = fetchAnswering(passed());
    vi.stubGlobal('fetch', stubbedFetch);

    await verify(TOKEN, CLIENT_IP);

    expect(sentRequest(stubbedFetch).url).toBe(ENDPOINT);
  });
});

// Turnstile documents 2,048 characters as the longest token it accepts
// (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). A
// longer one cannot be genuine, and the token is visitor-controlled, so it is refused
// here without spending a request.
describe('createTurnstileVerifier: the token length cap', () => {
  it('asks Turnstile about a token of exactly 2,048 characters', async () => {
    const fetchFake = fetchAnswering(passed());

    const result = await createTurnstileVerifier(CONFIG, fetchFake)(
      'a'.repeat(2048),
      CLIENT_IP,
    );

    expect(result).toBe(true);
    expect(fetchFake).toHaveBeenCalledTimes(1);
  });

  it.each([2049, 5000, 1_000_000])(
    'resolves false for a token of %i characters without a network call',
    async (length) => {
      const fetchFake = fetchAnswering(passed());

      const result = await createTurnstileVerifier(CONFIG, fetchFake)(
        'a'.repeat(length),
        CLIENT_IP,
      );

      expect(result).toBe(false);
      expect(fetchFake).not.toHaveBeenCalled();
    },
  );

  it('logs nothing for an oversized token', async () => {
    await createTurnstileVerifier(CONFIG, fetchAnswering(passed()))(
      'a'.repeat(2049),
      CLIENT_IP,
    );

    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe('createTurnstileVerifier: what Turnstile answers', () => {
  it('resolves true for a 200 whose JSON says success: true', async () => {
    const fetchFake = fetchAnswering(passed());

    await expect(
      createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
    ).resolves.toBe(true);
  });

  it('resolves true when success and the hostname are the only fields', async () => {
    const fetchFake = fetchAnswering(
      jsonAnswer({ success: true, hostname: 'carlos15erh.workers.dev' }),
    );

    await expect(
      createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
    ).resolves.toBe(true);
  });

  // The codes that blame the visitor's token: a 200 whose success is false is false. The
  // codes that blame the secret, the request or Turnstile have a describe of their own.
  it.each([
    'missing-input-response',
    'invalid-input-response',
    'timeout-or-duplicate',
  ])('resolves false for a 200 that says success: false (%s)', async (code) => {
    const fetchFake = fetchAnswering(
      jsonAnswer({ success: false, 'error-codes': [code] }),
    );

    await expect(
      createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
    ).resolves.toBe(false);
  });

  // Only a boolean `true` under `success` verifies, however truthy anything else looks.
  it.each([
    [{}],
    [{ success: 'true' }],
    [{ success: 1 }],
    [{ success: 'yes' }],
    [{ success: null }],
    [{ success: [true] }],
    [{ success: { value: true } }],
    [{ Success: true }],
    [{ result: { success: true } }],
    [[true]],
    [null],
    [0],
    ['success'],
    [true],
  ])('resolves false for a 200 whose JSON is %j', async (body) => {
    const fetchFake = fetchAnswering(jsonAnswer(body));

    await expect(
      createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
    ).resolves.toBe(false);
  });

  // Turnstile answers a pass and a fail alike with 200; any other status means it did
  // not give an answer, even when the body claims a success. The rejection carries the
  // status, so the caller's log line can say which one Turnstile answered.
  it.each([
    201, 202, 204, 301, 302, 307, 400, 401, 403, 404, 405, 408, 413, 429, 500,
    502, 503, 504,
  ])(
    'rejects with a ProviderFailure that carries the status when Turnstile answers %i',
    async (status) => {
      const fetchFake = fetchAnswering(jsonAnswer({ success: true }, status));

      const error = await rejectionOf(
        createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
      );

      expect(error.message).toBe(`Turnstile answered HTTP ${status}`);
      expect(error).toBeInstanceOf(ProviderFailure);
      expect((error as ProviderFailure).status).toBe(status);
      expect(failureSuffix(error)).toBe(` (HTTP ${status})`);
    },
  );

  // No answer, or one that cannot be read, so no status: these stay plain errors with
  // nothing for a log line to add.
  it.each([
    ['a network error', () => Promise.reject(new TypeError('fetch failed'))],
    [
      'a timeout',
      () => Promise.reject(new DOMException('timed out', 'TimeoutError')),
    ],
    [
      'a throw before a promise is returned',
      () => {
        throw new TypeError('Invalid URL');
      },
    ],
    [
      'a 200 that is not JSON',
      () => Promise.resolve(new Response('not json', { status: 200 })),
    ],
  ])('carries no detail when the request ends in %s', async (_label, fail) => {
    const error = await rejectionOf(
      createTurnstileVerifier(CONFIG, vi.fn<Fetch>(fail))(TOKEN, CLIENT_IP),
    );

    expect(error).not.toBeInstanceOf(ProviderFailure);
    expect(failureSuffix(error)).toBe('');
  });

  it.each([
    ['an empty body', ''],
    ['text', 'not json'],
    ['an HTML page', '<html><body>Request blocked</body></html>'],
    ['truncated JSON', '{"success": tru'],
    ['JSON with a trailing comma', '{"success": true,}'],
  ])('rejects when a 200 carries %s instead of JSON', async (_label, body) => {
    const fetchFake = fetchAnswering(new Response(body, { status: 200 }));

    const error = await rejectionOf(
      createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
    );

    expect(error.message).toBe('Turnstile answered with invalid JSON');
  });

  it('rejects with a fixed message when the request fails on the network', async () => {
    const fetchFake = vi.fn<Fetch>(async () => {
      throw new TypeError('fetch failed', { cause: new Error(LEAKY_TEXT) });
    });

    const error = await rejectionOf(
      createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
    );

    expect(error.message).toBe('The Turnstile request failed');
  });

  it.each([
    ['TimeoutError', 'The operation was aborted due to timeout'],
    ['AbortError', 'This operation was aborted'],
  ])(
    'rejects with a timed-out message when the request is aborted (%s)',
    async (name, text) => {
      const fetchFake = vi.fn<Fetch>(async () => {
        throw new DOMException(text, name);
      });

      const error = await rejectionOf(
        createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
      );

      expect(error.message).toBe(
        'The Turnstile request timed out after 8000 ms',
      );
    },
  );

  it('rejects when fetch only settles because the timeout signal fired', async () => {
    const timeout = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    // A provider that never answers: the request ends only when its signal aborts, as a
    // real `fetch` does.
    const stalled = vi.fn<Fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init.signal;
          if (signal?.aborted) return reject(signal.reason);
          signal?.addEventListener('abort', () => reject(signal.reason));
        }),
    );

    const pending = rejectionOf(
      createTurnstileVerifier(CONFIG, stalled)(TOKEN, CLIENT_IP),
    );
    timeout.abort(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );

    expect((await pending).message).toBe(
      'The Turnstile request timed out after 8000 ms',
    );
  });

  // The same signal covers the body, so a provider that sends headers and then stalls
  // ends the read with a timeout, not an invalid-JSON error.
  it('rejects with the timed-out message when the timeout fires while the body is read', async () => {
    const response = Object.assign(new Response('{}', { status: 200 }), {
      json: () =>
        Promise.reject(
          new DOMException(
            'The operation was aborted due to timeout',
            'TimeoutError',
          ),
        ),
    });

    const error = await rejectionOf(
      createTurnstileVerifier(CONFIG, fetchAnswering(response))(
        TOKEN,
        CLIENT_IP,
      ),
    );

    expect(error.message).toBe('The Turnstile request timed out after 8000 ms');
  });

  it('rejects when fetch throws before it returns a promise', async () => {
    const fetchFake = vi.fn<Fetch>(() => {
      throw new TypeError('Invalid URL');
    });

    const error = await rejectionOf(
      createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
    );

    expect(error.message).toBe('The Turnstile request failed');
  });

  // A Turnstile token is single use: asking again after a failure would only be told the
  // token was spent, and the caller already fails the submission.
  it.each([
    ['a 500', () => Promise.resolve(new Response('oops', { status: 500 }))],
    ['a 429', () => Promise.resolve(jsonAnswer({ success: true }, 429))],
    [
      'a fault code',
      () =>
        Promise.resolve(
          jsonAnswer({ success: false, 'error-codes': ['internal-error'] }),
        ),
    ],
    [
      'an unknown code',
      () =>
        Promise.resolve(
          jsonAnswer({ success: false, 'error-codes': ['some-future-error'] }),
        ),
    ],
    ['invalid JSON', () => Promise.resolve(new Response('nope'))],
    ['a network error', () => Promise.reject(new TypeError('fetch failed'))],
    [
      'a timeout',
      () => Promise.reject(new DOMException('timed out', 'TimeoutError')),
    ],
  ])('asks once and does not retry after %s', async (_label, answer) => {
    const fetchFake = vi.fn<Fetch>(answer);

    await rejectionOf(
      createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
    );

    expect(fetchFake).toHaveBeenCalledTimes(1);
  });
});

// Turnstile answers 200 with `success: false` and a list of error codes. Three of them blame
// the visitor's token, and the answer is `false`. Four blame our secret, our request or
// Turnstile itself, so the token was never judged: Turnstile could not be asked. The
// rejection then carries the code and `submitContact` logs it, which is how a wrong
// `TURNSTILE_SECRET_KEY` shows up in the log. A code outside these seven has a describe of
// its own below.
describe('createTurnstileVerifier: an answer that blames the request or Turnstile', () => {
  /** The rejection, which must be a ProviderFailure for the test to go on. */
  async function providerFailureFrom(response: Response) {
    const error = await rejectionOf(verifyAnswer(response));
    expect(error).toBeInstanceOf(ProviderFailure);
    return error as ProviderFailure;
  }

  it.each([
    'missing-input-secret',
    'invalid-input-secret',
    'bad-request',
    'internal-error',
  ])(
    'rejects with a ProviderFailure that carries %s when it is the only code',
    async (code) => {
      const error = await providerFailureFrom(failed([code]));

      expect(error.code).toBe(code);
      expect(error.status).toBeUndefined();
      expect(failureSuffix(error)).toBe(` (${code})`);
      expect(error.message).toBe(
        `Turnstile answered with the error code ${code}`,
      );
    },
  );

  // Whatever order Turnstile lists several codes in, the rejection names the first one of
  // this list, so the log says the same thing about the same fault: the secret outranks the
  // request, which outranks Turnstile's own trouble.
  const PRIORITY = [
    'missing-input-secret',
    'invalid-input-secret',
    'bad-request',
    'internal-error',
  ];

  const PAIRS = PRIORITY.flatMap((higher, index) =>
    PRIORITY.slice(index + 1).flatMap(
      (lower) =>
        [
          [[higher, lower], higher],
          [[lower, higher], higher],
        ] as const,
    ),
  );

  it.each(PAIRS)(
    'carries the higher-priority code when the answer lists %j: %s',
    async (codes, expected) => {
      const error = await providerFailureFrom(failed([...codes]));

      expect(error.code).toBe(expected);
    },
  );

  it.each([
    [
      [
        'internal-error',
        'bad-request',
        'invalid-input-secret',
        'missing-input-secret',
      ],
      'missing-input-secret',
    ],
    [['bad-request', 'internal-error', 'bad-request'], 'bad-request'],
    [['internal-error', 'internal-error'], 'internal-error'],
    [['some-new-code', 'internal-error', null, 'bad-request'], 'bad-request'],
  ])(
    'carries the first code of the priority list when the answer lists %j: %s',
    async (codes, expected) => {
      const error = await providerFailureFrom(failed(codes));

      expect(error.code).toBe(expected);
    },
  );

  // The request was at fault, so what Turnstile says about the token means nothing.
  it.each([
    [
      ['invalid-input-response', 'invalid-input-secret'],
      'invalid-input-secret',
    ],
    [
      ['invalid-input-secret', 'invalid-input-response'],
      'invalid-input-secret',
    ],
    [['timeout-or-duplicate', 'bad-request'], 'bad-request'],
    [['internal-error', 'missing-input-response'], 'internal-error'],
    [['missing-input-response', 'some-new-code', 'bad-request'], 'bad-request'],
  ])(
    'still rejects when the answer lists %j beside a fault code: %s',
    async (codes, expected) => {
      const error = await providerFailureFrom(failed(codes));

      expect(error.code).toBe(expected);
    },
  );

  it.each([
    'missing-input-secret',
    'invalid-input-secret',
    'bad-request',
    'internal-error',
  ])(
    'resolves true when success is true, whatever it also lists (%s)',
    async (code) => {
      await expect(
        verifyAnswer(
          jsonAnswer({
            success: true,
            hostname: 'carlos15erh.workers.dev',
            'error-codes': [code],
          }),
        ),
      ).resolves.toBe(true);
    },
  );

  // Only the boolean `true` verifies; with anything else under `success`, the codes decide.
  it.each([
    ['missing', {}],
    ['the string "true"', { success: 'true' }],
    ['the number 1', { success: 1 }],
    ['null', { success: null }],
  ])('rejects with the code when success is %s', async (_label, success) => {
    const error = await providerFailureFrom(
      jsonAnswer({ ...success, 'error-codes': ['invalid-input-secret'] }),
    );

    expect(error.code).toBe('invalid-input-secret');
  });

  it.each([
    ['one code that blames the token', ['invalid-input-response']],
    [
      'every code that blames the token',
      [
        'missing-input-response',
        'invalid-input-response',
        'timeout-or-duplicate',
      ],
    ],
    [
      'fault codes that are not strings',
      [null, 0, true, ['bad-request'], { code: 'bad-request' }],
    ],
    [
      'a token code and entries that are not strings',
      ['invalid-input-response', null, 0, ['some-future-error']],
    ],
    ['no codes', []],
  ])('resolves false when the answer lists %s', async (_label, codes) => {
    await expect(verifyAnswer(failed(codes))).resolves.toBe(false);
  });

  // `JSON.stringify` leaves out a key whose value is undefined, so `undefined` is "missing".
  it.each([
    ['missing', undefined],
    ['null', null],
    ['a string that holds a fault code', 'invalid-input-secret'],
    ['a string that is not a code', 'some-future-error'],
    ['an object keyed by a fault code', { 'invalid-input-secret': true }],
    ['an object keyed by an unknown code', { 'some-future-error': true }],
    ['an array-like object', { 0: 'invalid-input-secret', length: 1 }],
    ['a number', 1],
    ['true', true],
  ])('resolves false when error-codes is %s', async (_label, errorCodes) => {
    await expect(verifyAnswer(failed(errorCodes))).resolves.toBe(false);
  });

  it('puts nothing of the rest of the answer in the rejection', async () => {
    const error = await providerFailureFrom(
      failed(['invalid-input-secret'], {
        'error-message': LEAKY_TEXT,
        hostname: 'PROVIDER-BODY-SENTINEL',
        metadata: { echo: LEAKY_TEXT },
      }),
    );

    const exposed = everythingAbout(error);
    for (const value of [
      CONFIG.secretKey,
      TOKEN,
      CLIENT_IP,
      'PROVIDER-BODY-SENTINEL',
    ]) {
      expect(exposed).not.toContain(value);
    }
  });
});

// Cloudflare's table of Siteverify error codes lists seven (as of 2026-10-04): the three
// that blame the token and the four of TURNSTILE_FAULT_CODES. A code outside it proves
// nothing about the token, so the answer must not be mistaken for a rejected token: the
// verifier rejects, and `submitContact` logs its verifier line. The code is Turnstile's own
// text, so it is in no message and no property, and the line has no suffix.
describe('createTurnstileVerifier: an answer with an error code the Worker does not know', () => {
  const UNKNOWN_CODE = 'sentinel-unknown-code-q7';
  const UNKNOWN_CODE_MESSAGE =
    'Turnstile answered with an error code the Worker does not know';

  /** The rejection, which must be a plain Error, not a ProviderFailure, to go on. */
  async function plainErrorFrom(response: Response) {
    const error = await rejectionOf(verifyAnswer(response));
    expect(error.constructor).toBe(Error);
    return error;
  }

  it('rejects with a plain Error that has fixed text and no detail when the answer lists only an unknown code', async () => {
    const error = await plainErrorFrom(failed([UNKNOWN_CODE]));

    expect(error.message).toBe(UNKNOWN_CODE_MESSAGE);
    expect(Object.keys(error)).toEqual([]);
    expect(failureSuffix(error)).toBe('');
  });

  it('puts the unknown code in no message and no property', async () => {
    const error = await plainErrorFrom(failed([UNKNOWN_CODE]));

    expect(everythingAbout(error)).not.toContain(UNKNOWN_CODE);
  });

  // A string is unknown unless it is exactly one of the three token codes, whatever it
  // resembles.
  it.each([
    ['a code nobody listed', 'some-future-error'],
    ['a fault code in another case', 'Invalid-Input-Secret'],
    ['a fault code with a space before it', ' invalid-input-secret'],
    ['two fault codes in one string', 'bad-request,internal-error'],
    ['a token code in another case', 'INVALID-INPUT-RESPONSE'],
    ['a token code with a space after it', 'timeout-or-duplicate '],
    ['an empty string', ''],
  ])('rejects when the answer lists %s', async (_label, code) => {
    const error = await plainErrorFrom(failed([code]));

    expect(error.message).toBe(UNKNOWN_CODE_MESSAGE);
  });

  it.each([
    [['invalid-input-response', UNKNOWN_CODE]],
    [[UNKNOWN_CODE, 'timeout-or-duplicate']],
    [
      [
        'missing-input-response',
        'invalid-input-response',
        UNKNOWN_CODE,
        'timeout-or-duplicate',
      ],
    ],
    [['invalid-input-response', null, UNKNOWN_CODE]],
  ])(
    'still rejects when the answer lists %j beside token codes',
    async (codes) => {
      const error = await plainErrorFrom(failed(codes));

      expect(error.message).toBe(UNKNOWN_CODE_MESSAGE);
      expect(everythingAbout(error)).not.toContain(UNKNOWN_CODE);
    },
  );

  // A fault code decides first: the request was at fault, so that is what the log says.
  it.each([
    [[UNKNOWN_CODE, 'invalid-input-secret'], 'invalid-input-secret'],
    [['bad-request', UNKNOWN_CODE], 'bad-request'],
    [
      [UNKNOWN_CODE, 'internal-error', 'invalid-input-response'],
      'internal-error',
    ],
  ])(
    'rejects with the fault code, not the unknown one, when the answer lists %j',
    async (codes, expected) => {
      const error = await rejectionOf(verifyAnswer(failed(codes)));

      expect(error).toBeInstanceOf(ProviderFailure);
      expect((error as ProviderFailure).code).toBe(expected);
      expect(everythingAbout(error)).not.toContain(UNKNOWN_CODE);
    },
  );

  // Only the boolean `true` verifies; with anything else under `success`, the codes decide.
  it.each([
    ['missing', {}],
    ['the string "true"', { success: 'true' }],
    ['null', { success: null }],
  ])(
    'rejects when success is %s and the answer lists an unknown code',
    async (_label, success) => {
      const error = await plainErrorFrom(
        jsonAnswer({ ...success, 'error-codes': [UNKNOWN_CODE] }),
      );

      expect(error.message).toBe(UNKNOWN_CODE_MESSAGE);
    },
  );

  it('resolves true when success is true, whatever unknown code it also lists', async () => {
    await expect(
      verifyAnswer(
        jsonAnswer({
          success: true,
          hostname: 'carlos15erh.workers.dev',
          'error-codes': [UNKNOWN_CODE],
        }),
      ),
    ).resolves.toBe(true);
  });
});

// Astro sends the message of any error a handler throws to the visitor's browser, and a
// failing request, or `JSON.parse` on a body, often quotes its own input. So an error says
// what failed and, for a status or a code, which one: never the secret, the token, the
// visitor's IP or anything Turnstile said.
describe('createTurnstileVerifier: nothing private in an error or a log', () => {
  const PRIVATE_VALUES = [
    CONFIG.secretKey,
    TOKEN,
    CLIENT_IP,
    'PROVIDER-BODY-SENTINEL',
    'FORWARDED-SENTINEL',
  ];

  const failures: [string, () => Fetch][] = [
    [
      'a 4xx that quotes its request',
      () => async () => new Response(LEAKY_TEXT, { status: 400 }),
    ],
    [
      'a 5xx that quotes its request',
      () => async () => new Response(LEAKY_TEXT, { status: 500 }),
    ],
    [
      'a redirect that carries the request in its location',
      () => async () =>
        new Response(LEAKY_TEXT, {
          status: 302,
          headers: {
            location: 'https://elsewhere.example/?x=FORWARDED-SENTINEL',
          },
        }),
    ],
    [
      'a 200 whose body is not JSON and quotes the request (JSON.parse quotes its input)',
      () => async () => new Response(LEAKY_TEXT, { status: 200 }),
    ],
    [
      'a 200 with a fault code and other fields that quote the request',
      () => async () =>
        jsonAnswer({
          success: false,
          'error-codes': ['invalid-input-secret'],
          'error-message': LEAKY_TEXT,
          hostname: 'PROVIDER-BODY-SENTINEL',
        }),
    ],
    [
      'a 200 whose only error code is provider text that quotes the request',
      () => async () => failed([LEAKY_TEXT]),
    ],
    [
      'a network error that quotes the request in its message and cause',
      () => async () => {
        throw new TypeError(LEAKY_TEXT, { cause: new Error(LEAKY_TEXT) });
      },
    ],
    [
      'a timeout that quotes the request',
      () => async () => {
        throw new DOMException(LEAKY_TEXT, 'TimeoutError');
      },
    ],
    [
      'a throw that is not an Error',
      () => async () => {
        throw LEAKY_TEXT;
      },
    ],
  ];

  it.each(failures)('holds for %s', async (_label, makeFetch) => {
    const error = await rejectionOf(
      createTurnstileVerifier(CONFIG, vi.fn<Fetch>(makeFetch()))(
        TOKEN,
        CLIENT_IP,
      ),
    );

    const exposed = everythingAbout(error);
    for (const value of PRIVATE_VALUES) {
      expect(exposed).not.toContain(value);
    }
  });

  it.each(failures)('carries no cause for %s', async (_label, makeFetch) => {
    const error = await rejectionOf(
      createTurnstileVerifier(CONFIG, vi.fn<Fetch>(makeFetch()))(
        TOKEN,
        CLIENT_IP,
      ),
    );

    expect(error.cause).toBeUndefined();
    expect('cause' in error).toBe(false);
  });

  it.each(failures)(
    'is a plain Error or a ProviderFailure, with a short fixed message, for %s',
    async (_label, makeFetch) => {
      const error = await rejectionOf(
        createTurnstileVerifier(CONFIG, vi.fn<Fetch>(makeFetch()))(
          TOKEN,
          CLIENT_IP,
        ),
      );

      expect([Error, ProviderFailure]).toContain(error.constructor);
      expect(error.message).toMatch(
        /^(Turnstile answered HTTP \d{3}|Turnstile answered with the error code (missing-input-secret|invalid-input-secret|bad-request|internal-error)|Turnstile answered with an error code the Worker does not know|Turnstile answered with invalid JSON|The Turnstile request (failed|timed out after 8000 ms))$/,
      );
    },
  );

  // V8 quotes the whole input in a JSON syntax error when it is short, and only its first
  // characters when it is long, so a short body shows what an error built from the
  // parser's message would give away.
  it('keeps a short non-JSON body out of the error, where the parser quotes all of it', async () => {
    const response = new Response('BODY-Q7', { status: 200 });

    const error = await rejectionOf(
      createTurnstileVerifier(CONFIG, fetchAnswering(response))(
        TOKEN,
        CLIENT_IP,
      ),
    );

    expect(everythingAbout(error)).not.toContain('BODY-Q7');
  });

  it('does not read the response body of a status it rejects', async () => {
    const response = new Response(LEAKY_TEXT, { status: 500 });

    await rejectionOf(
      createTurnstileVerifier(CONFIG, fetchAnswering(response))(
        TOKEN,
        CLIENT_IP,
      ),
    );

    expect(response.bodyUsed).toBe(false);
  });

  it('logs nothing, whatever Turnstile answers: the caller reports a failed verifier once', async () => {
    const run = (response: Response | (() => Promise<Response>)) =>
      createTurnstileVerifier(CONFIG, fetchAnswering(response))(
        TOKEN,
        CLIENT_IP,
      );

    await run(passed());
    await run(
      jsonAnswer({ success: false, 'error-codes': ['invalid-input-response'] }),
    );
    await rejectionOf(
      run(jsonAnswer({ success: false, 'error-codes': ['bad-request'] })),
    );
    await rejectionOf(
      run(jsonAnswer({ success: false, 'error-codes': ['some-future-error'] })),
    );
    await rejectionOf(run(new Response(LEAKY_TEXT, { status: 500 })));
    await rejectionOf(run(new Response(LEAKY_TEXT, { status: 200 })));
    await rejectionOf(
      createTurnstileVerifier(
        CONFIG,
        vi.fn<Fetch>(async () => {
          throw new TypeError(LEAKY_TEXT);
        }),
      )(TOKEN, CLIENT_IP),
    );

    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe('createTurnstileVerifier: the hostname of a success', () => {
  const answeringHostname = (hostname: unknown) =>
    jsonAnswer({ success: true, 'error-codes': [], hostname });

  const verifyWith = (
    allowedHostnames: readonly string[],
    response: Response,
  ) =>
    createTurnstileVerifier(
      { ...CONFIG, allowedHostnames },
      fetchAnswering(response),
    )(TOKEN, CLIENT_IP);

  it.each([
    'carlos15erh.workers.dev',
    'portfolio-project.carlos15erh.workers.dev',
    'Carlos15erh.Workers.Dev.',
  ])('resolves true for a token solved on %s', async (hostname) => {
    await expect(verifyWith([], answeringHostname(hostname))).resolves.toBe(
      true,
    );
  });

  it.each([
    ['another site', 'attacker.example'],
    ['a look-alike prefix', 'evilcarlos15erh.workers.dev'],
    ['the host inside another', 'carlos15erh.workers.dev.attacker.com'],
    ['a hyphen look-alike', 'carlos15erh-workers.dev'],
    ['an empty hostname', ''],
    ['a hostname that is not text', 42],
    ['a hostname that is not a plain hostname', 'carlos15erh.workers.dev/x'],
  ])(
    'resolves false for a success on %s, and logs one warning',
    async (_label, hostname) => {
      await expect(verifyWith([], answeringHostname(hostname))).resolves.toBe(
        false,
      );

      const [, , warn] = consoleSpies;
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toMatch(/^contact: Turnstile /);
    },
  );

  it('resolves false for a success that names no hostname', async () => {
    await expect(
      verifyWith([], jsonAnswer({ success: true, 'error-codes': [] })),
    ).resolves.toBe(false);
  });

  it('names the foreign hostname in the warning when it is a plain one', async () => {
    await verifyWith([], answeringHostname('Attacker.Example.'));

    expect(consoleSpies[2]).toHaveBeenCalledWith(
      'contact: Turnstile solved a token on a host that is not allowed (attacker.example)',
    );
  });

  it('never prints the secret, the token, the IP or a hostname that is not plain', async () => {
    const hostname = `evil.example
${LEAKY_TEXT}`;

    await verifyWith([], answeringHostname(hostname));

    const printed = JSON.stringify(consoleSpies.map((spy) => spy.mock.calls));
    for (const fragment of [
      'secret-key-sentinel-1',
      TOKEN,
      CLIENT_IP,
      'PROVIDER-BODY-SENTINEL',
      'evil.example',
    ]) {
      expect(printed).not.toContain(fragment);
    }
  });

  it('allows a listed host and its subdomains', async () => {
    await expect(
      verifyWith(['example.com'], answeringHostname('www.example.com')),
    ).resolves.toBe(true);
    await expect(
      verifyWith(['example.com'], answeringHostname('evilexample.com')),
    ).resolves.toBe(false);
  });

  it('logs nothing when the hostname is allowed', async () => {
    await verifyWith([], answeringHostname('carlos15erh.workers.dev'));

    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('does not check the hostname of an answer that is not a success', async () => {
    await expect(
      verifyWith(
        [],
        jsonAnswer({
          success: false,
          'error-codes': ['invalid-input-response'],
          hostname: 'attacker.example',
        }),
      ),
    ).resolves.toBe(false);

    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
