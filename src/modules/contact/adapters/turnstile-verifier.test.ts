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

const CONFIG = { secretKey: 'secret-key-sentinel-1', verifyUrl: undefined };
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

  it('resolves true when success is the only field', async () => {
    const fetchFake = fetchAnswering(jsonAnswer({ success: true }));

    await expect(
      createTurnstileVerifier(CONFIG, fetchFake)(TOKEN, CLIENT_IP),
    ).resolves.toBe(true);
  });

  // The visitor-side codes Turnstile documents, then the ones that name a problem with the
  // request or with Turnstile itself: a 200 whose success is false is false either way.
  it.each([
    'missing-input-response',
    'invalid-input-response',
    'timeout-or-duplicate',
    'missing-input-secret',
    'invalid-input-secret',
    'bad-request',
    'internal-error',
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

// Astro sends the message of any error a handler throws to the visitor's browser, and a
// failing request, or `JSON.parse` on a body, often quotes its own input. So an error says
// what failed and, for a status, which one: never the secret, the token, the visitor's IP
// or anything Turnstile said.
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
        /^(Turnstile answered HTTP \d{3}|Turnstile answered with invalid JSON|The Turnstile request (failed|timed out after 8000 ms))$/,
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
    await run(jsonAnswer({ success: false, 'error-codes': ['bad-request'] }));
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
