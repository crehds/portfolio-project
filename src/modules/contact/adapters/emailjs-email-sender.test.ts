import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContactMessage } from '../ports';
import { createEmailJsSender } from './emailjs-email-sender';
import type { Fetch } from './outbound';
import { everythingAbout, rejectionOf, spyOnConsole } from './testing';

// Every test injects a fake `fetch`. Nothing here reaches EmailJS or any network.

const CONFIG = {
  serviceId: 'service-id-sentinel-1',
  templateId: 'template-id-sentinel-2',
  publicKey: 'public-key-sentinel-3',
  privateKey: 'private-key-sentinel-4',
  apiUrl: undefined,
};

const MESSAGE: ContactMessage = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hello there.\nI would like to talk about a project.',
  locale: 'es',
};

const ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

/** What the provider's own error could quote back: a key, the visitor's text, its body. */
const LEAKY_TEXT =
  'key=private-key-sentinel-4 name=Ada Lovelace email=ada@example.com body=PROVIDER-BODY-SENTINEL';

let consoleSpies: ReturnType<typeof spyOnConsole>;

beforeEach(() => {
  consoleSpies = spyOnConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A fake `fetch` that answers with `response` (or whatever `answer` returns). */
function fetchAnswering(response: Response | (() => Promise<Response>)) {
  return vi.fn<Fetch>(async () =>
    response instanceof Response ? response : response(),
  );
}

const accepted = () => new Response('OK', { status: 200 });

/** The request `fetch` received, taken apart. */
function sentRequest(fetchFake: ReturnType<typeof fetchAnswering>) {
  expect(fetchFake).toHaveBeenCalledTimes(1);
  const [url, init] = fetchFake.mock.calls[0];

  return {
    url,
    init,
    headers: Object.fromEntries(new Headers(init.headers)),
    body: JSON.parse(String(init.body)) as Record<string, unknown>,
  };
}

describe('createEmailJsSender: the request', () => {
  it('posts to the EmailJS send endpoint', async () => {
    const fetchFake = fetchAnswering(accepted());

    await createEmailJsSender(CONFIG, fetchFake).send(MESSAGE);

    const { url, init } = sentRequest(fetchFake);
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
  });

  it('sends JSON and no other header, so no key travels in a header', async () => {
    const fetchFake = fetchAnswering(accepted());

    await createEmailJsSender(CONFIG, fetchFake).send(MESSAGE);

    expect(sentRequest(fetchFake).headers).toEqual({
      'content-type': 'application/json',
    });
  });

  it('sends the ids, both keys and the four template parameters, and nothing else', async () => {
    const fetchFake = fetchAnswering(accepted());

    await createEmailJsSender(CONFIG, fetchFake).send(MESSAGE);

    expect(sentRequest(fetchFake).body).toEqual({
      service_id: 'service-id-sentinel-1',
      template_id: 'template-id-sentinel-2',
      user_id: 'public-key-sentinel-3',
      accessToken: 'private-key-sentinel-4',
      template_params: {
        from_name: 'Ada Lovelace',
        reply_to: 'ada@example.com',
        message: 'Hello there.\nI would like to talk about a project.',
        locale: 'es',
      },
    });
  });

  it('takes the public key for user_id and the private key for accessToken', async () => {
    const fetchFake = fetchAnswering(accepted());

    await createEmailJsSender(
      { ...CONFIG, publicKey: 'the-public-one', privateKey: 'the-private-one' },
      fetchFake,
    ).send(MESSAGE);

    const { body } = sentRequest(fetchFake);
    expect(body.user_id).toBe('the-public-one');
    expect(body.accessToken).toBe('the-private-one');
  });

  it('hands the provider the four message fields only, whatever else the object carries', async () => {
    const fetchFake = fetchAnswering(accepted());
    const crowded = {
      ...MESSAGE,
      website: 'https://spam.example',
      'cf-turnstile-response': 'token-sentinel',
      ip: '203.0.113.7',
    };

    await createEmailJsSender(CONFIG, fetchFake).send(crowded);

    const { body } = sentRequest(fetchFake);
    expect(Object.keys(body.template_params as object).sort()).toEqual([
      'from_name',
      'locale',
      'message',
      'reply_to',
    ]);
    expect(JSON.stringify(body)).not.toContain('token-sentinel');
    expect(JSON.stringify(body)).not.toContain('203.0.113.7');
    expect(JSON.stringify(body)).not.toContain('spam.example');
  });

  it('keeps the message as written: line breaks, quotes and non-Latin text', async () => {
    const fetchFake = fetchAnswering(accepted());
    const message = 'Line one\r\nLine "two"\tñ 李雷 🙂 {{not_a_variable}}';

    await createEmailJsSender(CONFIG, fetchFake).send({ ...MESSAGE, message });

    expect(
      (sentRequest(fetchFake).body.template_params as { message: string })
        .message,
    ).toBe(message);
  });

  it('sends each locale the visitor used', async () => {
    for (const locale of ['en', 'es'] as const) {
      const fetchFake = fetchAnswering(accepted());

      await createEmailJsSender(CONFIG, fetchFake).send({
        ...MESSAGE,
        locale,
      });

      expect(
        (sentRequest(fetchFake).body.template_params as { locale: string })
          .locale,
      ).toBe(locale);
    }
  });

  it('posts to the apiUrl seam instead when one is set', async () => {
    const fetchFake = fetchAnswering(accepted());

    await createEmailJsSender(
      { ...CONFIG, apiUrl: 'http://127.0.0.1:4332/emailjs/send' },
      fetchFake,
    ).send(MESSAGE);

    expect(sentRequest(fetchFake).url).toBe(
      'http://127.0.0.1:4332/emailjs/send',
    );
  });

  it('gives the request AbortSignal.timeout(8000)', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetchFake = fetchAnswering(accepted());

    await createEmailJsSender(CONFIG, fetchFake).send(MESSAGE);

    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(8000);
    expect(sentRequest(fetchFake).init.signal).toBe(
      timeout.mock.results[0].value,
    );
  });

  it('does not follow a redirect, which could turn the POST into a GET that answers 200', async () => {
    const fetchFake = fetchAnswering(accepted());

    await createEmailJsSender(CONFIG, fetchFake).send(MESSAGE);

    expect(sentRequest(fetchFake).init.redirect).toBe('manual');
  });

  it('makes one request per message', async () => {
    const fetchFake = fetchAnswering(() => Promise.resolve(accepted()));
    const sender = createEmailJsSender(CONFIG, fetchFake);

    await sender.send(MESSAGE);
    await sender.send(MESSAGE);

    expect(fetchFake).toHaveBeenCalledTimes(2);
  });

  it('uses the global fetch, looked up when it sends, when none is injected', async () => {
    const sender = createEmailJsSender(CONFIG);
    const stubbedFetch = fetchAnswering(accepted());
    vi.stubGlobal('fetch', stubbedFetch);

    await sender.send(MESSAGE);

    expect(sentRequest(stubbedFetch).url).toBe(ENDPOINT);
  });
});

describe('createEmailJsSender: what the provider answers', () => {
  it('resolves with no value when EmailJS answers 200', async () => {
    const fetchFake = fetchAnswering(new Response('OK', { status: 200 }));

    await expect(
      createEmailJsSender(CONFIG, fetchFake).send(MESSAGE),
    ).resolves.toBeUndefined();
  });

  it('resolves on a 200 whatever the body says', async () => {
    const fetchFake = fetchAnswering(new Response('', { status: 200 }));

    await expect(
      createEmailJsSender(CONFIG, fetchFake).send(MESSAGE),
    ).resolves.toBeUndefined();
  });

  // Only 200 is an acceptance: any other status, success-looking or not, is not proof
  // that the message was handed to the owner's mailbox.
  it.each([
    201, 202, 204, 206, 301, 302, 304, 307, 308, 400, 401, 403, 404, 405, 408,
    409, 412, 413, 415, 422, 429, 500, 502, 503, 504,
  ])('rejects when EmailJS answers %i', async (status) => {
    const fetchFake = fetchAnswering(new Response(null, { status }));

    const error = await rejectionOf(
      createEmailJsSender(CONFIG, fetchFake).send(MESSAGE),
    );

    expect(error.message).toBe(`EmailJS answered HTTP ${status}`);
  });

  it('rejects with a fixed message when the request fails on the network', async () => {
    const fetchFake = vi.fn<Fetch>(async () => {
      throw new TypeError('fetch failed', { cause: new Error(LEAKY_TEXT) });
    });

    const error = await rejectionOf(
      createEmailJsSender(CONFIG, fetchFake).send(MESSAGE),
    );

    expect(error.message).toBe('The EmailJS request failed');
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
        createEmailJsSender(CONFIG, fetchFake).send(MESSAGE),
      );

      expect(error.message).toBe('The EmailJS request timed out after 8000 ms');
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
      createEmailJsSender(CONFIG, stalled).send(MESSAGE),
    );
    timeout.abort(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );

    expect((await pending).message).toBe(
      'The EmailJS request timed out after 8000 ms',
    );
  });

  it('rejects when fetch throws before it returns a promise', async () => {
    const fetchFake = vi.fn<Fetch>(() => {
      throw new TypeError('Invalid URL');
    });

    const error = await rejectionOf(
      createEmailJsSender(CONFIG, fetchFake).send(MESSAGE),
    );

    expect(error.message).toBe('The EmailJS request failed');
  });

  // EmailJS allows one request a second and 200 a month, and a Turnstile token is single
  // use: a second try would only spend quota, and the caller already reports the failure.
  it.each([
    [
      'a 429',
      () => Promise.resolve(new Response('slow down', { status: 429 })),
    ],
    ['a 500', () => Promise.resolve(new Response('oops', { status: 500 }))],
    ['a network error', () => Promise.reject(new TypeError('fetch failed'))],
    [
      'a timeout',
      () => Promise.reject(new DOMException('timed out', 'TimeoutError')),
    ],
  ])('tries once and does not retry after %s', async (_label, answer) => {
    const fetchFake = vi.fn<Fetch>(answer);

    await rejectionOf(createEmailJsSender(CONFIG, fetchFake).send(MESSAGE));

    expect(fetchFake).toHaveBeenCalledTimes(1);
  });
});

// Astro sends the message of any error a handler throws to the visitor's browser, and a
// failing request often quotes its own body, headers or cause. So an error says what
// failed and, for a status, which one: never a key, the visitor's text or the provider's.
describe('createEmailJsSender: nothing private in an error or a log', () => {
  const PRIVATE_VALUES = [
    CONFIG.serviceId,
    CONFIG.templateId,
    CONFIG.publicKey,
    CONFIG.privateKey,
    MESSAGE.name,
    MESSAGE.email,
    'I would like to talk about a project',
    'PROVIDER-BODY-SENTINEL',
    'FORWARDED-SENTINEL',
  ];

  const failures: [string, () => Fetch][] = [
    [
      'a 4xx that quotes its request',
      () => async () => new Response(LEAKY_TEXT, { status: 403 }),
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
    const fetchFake = vi.fn<Fetch>(makeFetch());

    const error = await rejectionOf(
      createEmailJsSender(CONFIG, fetchFake).send(MESSAGE),
    );

    const exposed = everythingAbout(error);
    for (const value of PRIVATE_VALUES) {
      expect(exposed).not.toContain(value);
    }
  });

  it.each(failures)('carries no cause for %s', async (_label, makeFetch) => {
    const error = await rejectionOf(
      createEmailJsSender(CONFIG, vi.fn<Fetch>(makeFetch())).send(MESSAGE),
    );

    expect(error.cause).toBeUndefined();
    expect('cause' in error).toBe(false);
  });

  it.each(failures)(
    'is a plain Error with a short fixed message for %s',
    async (_label, makeFetch) => {
      const error = await rejectionOf(
        createEmailJsSender(CONFIG, vi.fn<Fetch>(makeFetch())).send(MESSAGE),
      );

      expect(error.constructor).toBe(Error);
      expect(error.message).toMatch(
        /^(EmailJS answered HTTP \d{3}|The EmailJS request (failed|timed out after 8000 ms))$/,
      );
    },
  );

  it('never reads the provider response body', async () => {
    const response = new Response(LEAKY_TEXT, { status: 500 });
    const fetchFake = fetchAnswering(response);

    await rejectionOf(createEmailJsSender(CONFIG, fetchFake).send(MESSAGE));

    expect(response.bodyUsed).toBe(false);
  });

  it('logs nothing on success or on failure: the caller reports the failure once', async () => {
    const sender = createEmailJsSender(
      CONFIG,
      fetchAnswering(() => Promise.resolve(accepted())),
    );
    await sender.send(MESSAGE);
    await rejectionOf(
      createEmailJsSender(
        CONFIG,
        fetchAnswering(new Response(LEAKY_TEXT, { status: 500 })),
      ).send(MESSAGE),
    );
    await rejectionOf(
      createEmailJsSender(
        CONFIG,
        vi.fn<Fetch>(async () => {
          throw new TypeError(LEAKY_TEXT);
        }),
      ).send(MESSAGE),
    );

    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
