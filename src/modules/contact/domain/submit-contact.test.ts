import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EmailSender, RateLimiter, TurnstileVerifier } from '../ports';
import { ProviderFailure } from '../provider-failure';
import { contactSchema } from '../schema';
import {
  submitContact,
  type ContactDeps,
  type ContactOutcome,
} from './submit-contact';

const CLIENT_IP = '203.0.113.7';
const TOKEN = 'turnstile-token-abc';

// The lines a failed dependency leaves in the log. Spelled out here, not imported, so that
// a change to the wording of a line is a change to this file too.
const VERIFIER_LINE =
  'contact: the Turnstile verifier failed, so the submission was rejected';
const SENDER_LINE = 'contact: the email sender failed';
const LIMITER_LINE =
  'contact: the rate limiter failed, so the request was let through';

/**
 * A submission after Astro and the schema are done with it, which is exactly what the
 * Action handler passes to `submitContact`: the visitor's text trimmed, the locale
 * checked, the honeypot and the token as they arrived.
 */
function submission(overrides: Record<string, unknown> = {}) {
  return contactSchema.parse({
    name: '  Ada Lovelace ',
    email: ' ada@example.com ',
    message: ' Hello there. ',
    locale: 'es',
    'cf-turnstile-response': TOKEN,
    ...overrides,
  });
}

/** The part of the Action context `submitContact` reads: the request's headers. */
function contextWith(headers: Record<string, string> = {}) {
  return {
    request: new Request('https://example.com/contact', {
      method: 'POST',
      headers,
    }),
  };
}

const fromCloudflare = () => contextWith({ 'cf-connecting-ip': CLIENT_IP });

/** Fakes for the three dependencies; they all succeed until a test says otherwise. */
function fakes() {
  const calls: string[] = [];
  const send = vi.fn<EmailSender['send']>(async () => {
    calls.push('send');
  });
  const verifyTurnstile = vi.fn<TurnstileVerifier>(async () => {
    calls.push('verifyTurnstile');
    return true;
  });
  const rateLimiter = vi.fn<RateLimiter>(async () => {
    calls.push('rateLimiter');
    return true;
  });
  const deps: ContactDeps = {
    emailSender: { send },
    verifyTurnstile,
    rateLimiter,
  };

  return { calls, send, verifyTurnstile, rateLimiter, deps };
}

const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const;

let consoleSpies: ReturnType<typeof spyOnConsole>;

function spyOnConsole() {
  return consoleMethods.map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  );
}

beforeEach(() => {
  consoleSpies = spyOnConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Every console call, whichever method, as the list of its arguments. */
function loggedCalls(): unknown[][] {
  return consoleSpies.flatMap((spy) => spy.mock.calls);
}

/** Every argument of every console call, as one string. */
function everythingLogged(): string {
  return consoleSpies
    .flatMap((spy) => spy.mock.calls)
    .flat()
    .map((argument) =>
      argument instanceof Error
        ? `${argument.name}: ${argument.message}\n${argument.stack}`
        : typeof argument === 'string'
          ? argument
          : JSON.stringify(argument),
    )
    .join('\n');
}

describe('submitContact: a good submission', () => {
  it('sends exactly one message with the trimmed values and the locale, then reports it sent', async () => {
    const { deps, send } = fakes();

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'sent' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'Hello there.',
      locale: 'es',
    });
  });

  it('hands the sender nothing but the four message fields', async () => {
    const { deps, send } = fakes();

    await submitContact(submission(), deps, fromCloudflare());

    // No honeypot, no Turnstile token, no IP: the message is all the sender may see.
    expect(Object.keys(send.mock.calls[0][0]).sort()).toEqual([
      'email',
      'locale',
      'message',
      'name',
    ]);
  });

  it('checks the rate limit, then Turnstile, then sends', async () => {
    const { deps, calls } = fakes();

    await submitContact(submission(), deps, fromCloudflare());

    expect(calls).toEqual(['rateLimiter', 'verifyTurnstile', 'send']);
  });

  it('counts the request under the cf-connecting-ip key', async () => {
    const { deps, rateLimiter } = fakes();

    await submitContact(submission(), deps, fromCloudflare());

    expect(rateLimiter).toHaveBeenCalledTimes(1);
    expect(rateLimiter).toHaveBeenCalledWith(CLIENT_IP);
  });

  it('gives Turnstile the token and the same client IP', async () => {
    const { deps, verifyTurnstile } = fakes();

    await submitContact(submission(), deps, fromCloudflare());

    expect(verifyTurnstile).toHaveBeenCalledTimes(1);
    expect(verifyTurnstile).toHaveBeenCalledWith(TOKEN, CLIENT_IP);
  });

  it('uses the shared key and no remote IP when Cloudflare sent no client IP', async () => {
    const { deps, rateLimiter, verifyTurnstile } = fakes();

    await submitContact(submission(), deps, contextWith());

    expect(rateLimiter).toHaveBeenCalledWith('unknown');
    expect(verifyTurnstile).toHaveBeenCalledWith(TOKEN, undefined);
  });

  it('ignores X-Forwarded-For and X-Real-IP, which a client can set to anything', async () => {
    const { deps, rateLimiter, verifyTurnstile } = fakes();
    const context = contextWith({
      'x-forwarded-for': '198.51.100.99',
      'x-real-ip': '198.51.100.98',
    });

    await submitContact(submission(), deps, context);

    expect(rateLimiter).toHaveBeenCalledWith('unknown');
    expect(verifyTurnstile).toHaveBeenCalledWith(TOKEN, undefined);
  });

  it('logs nothing', async () => {
    const { deps } = fakes();

    await submitContact(submission(), deps, fromCloudflare());

    expect(everythingLogged()).toBe('');
  });
});

describe('submitContact: the honeypot', () => {
  it.each([
    ['a URL', 'https://spam.example'],
    ['a single character', 'x'],
    ['only whitespace', '   '],
  ])(
    'answers %s with a silent success and calls no dependency',
    async (_label, website) => {
      const { deps, send, verifyTurnstile, rateLimiter } = fakes();

      const outcome = await submitContact(
        submission({ website }),
        deps,
        fromCloudflare(),
      );

      expect(outcome).toEqual({ kind: 'sent' });
      expect(rateLimiter).not.toHaveBeenCalled();
      expect(verifyTurnstile).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('answers exactly as it does for a real success, so a bot learns nothing', async () => {
    const real = await submitContact(
      submission(),
      fakes().deps,
      fromCloudflare(),
    );
    const trapped = await submitContact(
      submission({ website: 'https://spam.example' }),
      fakes().deps,
      fromCloudflare(),
    );

    expect(trapped).toEqual(real);
  });

  it('logs nothing for a filled honeypot', async () => {
    await submitContact(
      submission({ website: 'https://spam.example' }),
      fakes().deps,
      fromCloudflare(),
    );

    expect(everythingLogged()).toBe('');
  });

  it.each([[undefined], ['']])(
    'treats %j as an empty honeypot and carries on',
    async (website) => {
      const { deps, send } = fakes();

      const outcome = await submitContact(
        submission({ website }),
        deps,
        fromCloudflare(),
      );

      expect(outcome).toEqual({ kind: 'sent' });
      expect(send).toHaveBeenCalledTimes(1);
    },
  );
});

describe('submitContact: the rate limit', () => {
  it('stops a submission the limiter denies before Turnstile and the sender', async () => {
    const { deps, rateLimiter, verifyTurnstile, send } = fakes();
    rateLimiter.mockResolvedValue(false);

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'rate_limited' });
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('lets the request through when the limiter rejects (fail open)', async () => {
    const { deps, rateLimiter, verifyTurnstile, send } = fakes();
    rateLimiter.mockRejectedValue(new Error('binding unavailable'));

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'sent' });
    expect(verifyTurnstile).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('lets the request through when the limiter throws synchronously', async () => {
    const { deps, rateLimiter, send } = fakes();
    rateLimiter.mockImplementation(() => {
      throw new Error('binding unavailable');
    });

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'sent' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('logs one warning, and nothing from the error, when the limiter fails', async () => {
    const { deps, rateLimiter } = fakes();
    rateLimiter.mockRejectedValue(new Error('SECRET-limiter-detail'));

    await submitContact(submission(), deps, fromCloudflare());

    expect(vi.mocked(console.warn)).toHaveBeenCalledTimes(1);
    expect(everythingLogged()).not.toContain('SECRET-limiter-detail');
  });

  it('only an explicit false denies: any other answer from the limiter lets the request through', async () => {
    const { deps, rateLimiter, send } = fakes();
    rateLimiter.mockResolvedValue(undefined as unknown as boolean);

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'sent' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('submitContact: Turnstile', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['only whitespace', '  \t '],
  ])(
    'fails a submission whose token is %s without asking Turnstile or sending',
    async (_label, token) => {
      const { deps, verifyTurnstile, send } = fakes();

      const outcome = await submitContact(
        submission({ 'cf-turnstile-response': token }),
        deps,
        fromCloudflare(),
      );

      expect(outcome).toEqual({ kind: 'verification_failed' });
      expect(verifyTurnstile).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('still spends rate-limit budget on a submission with no token', async () => {
    const { deps, rateLimiter } = fakes();

    await submitContact(
      submission({ 'cf-turnstile-response': undefined }),
      deps,
      fromCloudflare(),
    );

    expect(rateLimiter).toHaveBeenCalledTimes(1);
    expect(rateLimiter).toHaveBeenCalledWith(CLIENT_IP);
  });

  it('rate-limits a tokenless submission before it reports a failed verification', async () => {
    const { deps, rateLimiter } = fakes();
    rateLimiter.mockResolvedValue(false);

    const outcome = await submitContact(
      submission({ 'cf-turnstile-response': undefined }),
      deps,
      fromCloudflare(),
    );

    expect(outcome).toEqual({ kind: 'rate_limited' });
  });

  it('fails a submission Turnstile rejects, and does not send', async () => {
    const { deps, verifyTurnstile, send } = fakes();
    verifyTurnstile.mockResolvedValue(false);

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'verification_failed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('fails the submission when the verifier rejects (fail closed)', async () => {
    const { deps, verifyTurnstile, send } = fakes();
    verifyTurnstile.mockRejectedValue(new Error('siteverify unreachable'));

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'verification_failed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('fails the submission when the verifier throws synchronously', async () => {
    const { deps, verifyTurnstile, send } = fakes();
    verifyTurnstile.mockImplementation(() => {
      throw new Error('siteverify unreachable');
    });

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'verification_failed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('only an explicit true verifies: a truthy answer that is not true fails', async () => {
    const { deps, verifyTurnstile, send } = fakes();
    verifyTurnstile.mockResolvedValue({
      success: false,
    } as unknown as boolean);

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'verification_failed' });
    expect(send).not.toHaveBeenCalled();
  });

  it('logs one error, and nothing from the thrown error, when the verifier fails', async () => {
    const { deps, verifyTurnstile } = fakes();
    verifyTurnstile.mockRejectedValue(new Error('SECRET-verifier-detail'));

    await submitContact(submission(), deps, fromCloudflare());

    expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
    expect(everythingLogged()).not.toContain('SECRET-verifier-detail');
  });
});

describe('submitContact: delivery', () => {
  it('reports delivery_failed when the sender rejects', async () => {
    const { deps, send } = fakes();
    send.mockRejectedValue(new Error('EmailJS answered 500'));

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'delivery_failed' });
  });

  it('reports delivery_failed when the sender throws synchronously', async () => {
    const { deps, send } = fakes();
    send.mockImplementation(() => {
      throw new Error('EmailJS answered 500');
    });

    const outcome = await submitContact(submission(), deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'delivery_failed' });
  });

  it('tries the sender once and does not retry', async () => {
    const { deps, send } = fakes();
    send.mockRejectedValue(new Error('EmailJS answered 500'));

    await submitContact(submission(), deps, fromCloudflare());

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('logs one error when the sender fails', async () => {
    const { deps, send } = fakes();
    send.mockRejectedValue(new Error('EmailJS answered 500'));

    await submitContact(submission(), deps, fromCloudflare());

    expect(vi.mocked(console.error)).toHaveBeenCalledTimes(1);
  });
});

type Fakes = ReturnType<typeof fakes>;

/**
 * The two steps that fail closed, each with the line it logs, what the visitor gets, and
 * how to make it fail with a given error.
 */
const closedSteps: [
  step: string,
  line: string,
  outcome: ContactOutcome,
  failWith: (f: Fakes, error: unknown) => void,
][] = [
  [
    'the verifier',
    VERIFIER_LINE,
    { kind: 'verification_failed' },
    (f, error) => f.verifyTurnstile.mockRejectedValue(error),
  ],
  [
    'the sender',
    SENDER_LINE,
    { kind: 'delivery_failed' },
    (f, error) => f.send.mockRejectedValue(error),
  ],
];

// A failing dependency leaves one line in the log: fixed text that names the step, plus at
// most a closed suffix. The suffix comes from a ProviderFailure alone, and it is the one
// thing read from an error: its message, its cause and every other property stay out.
describe('submitContact: the line a failed dependency leaves in the log', () => {
  it.each(closedSteps)(
    'adds the HTTP status a ProviderFailure carries when %s fails',
    async (_step, line, _outcome, failWith) => {
      const f = fakes();
      failWith(
        f,
        new ProviderFailure('The provider answered', { status: 503 }),
      );

      await submitContact(submission(), f.deps, fromCloudflare());

      expect(vi.mocked(console.error).mock.calls).toEqual([
        [`${line} (HTTP 503)`],
      ]);
      expect(loggedCalls()).toHaveLength(1);
    },
  );

  const faultCodeCases = closedSteps.flatMap(([step, line, , failWith]) =>
    (
      [
        'missing-input-secret',
        'invalid-input-secret',
        'bad-request',
        'internal-error',
      ] as const
    ).map((code) => [`${code}, from ${step}`, line, failWith, code] as const),
  );

  it.each(faultCodeCases)(
    'adds the Turnstile fault code a ProviderFailure carries: %s',
    async (_label, line, failWith, code) => {
      const f = fakes();
      failWith(f, new ProviderFailure('The provider answered', { code }));

      await submitContact(submission(), f.deps, fromCloudflare());

      expect(vi.mocked(console.error).mock.calls).toEqual([
        [`${line} (${code})`],
      ]);
      expect(loggedCalls()).toHaveLength(1);
    },
  );

  it.each(closedSteps)(
    'gives the visitor the same outcome as before when %s fails with a ProviderFailure',
    async (_step, _line, outcome, failWith) => {
      const f = fakes();
      failWith(
        f,
        new ProviderFailure('The provider answered', { status: 503 }),
      );

      const result = await submitContact(
        submission(),
        f.deps,
        fromCloudflare(),
      );

      expect(result).toEqual(outcome);
    },
  );

  it.each(closedSteps)(
    'keeps the line exactly as it was when %s fails with a plain Error',
    async (_step, line, _outcome, failWith) => {
      const f = fakes();
      // The message names a status, but no text is ever read from an error.
      failWith(f, new Error('EmailJS answered HTTP 403'));

      await submitContact(submission(), f.deps, fromCloudflare());

      expect(vi.mocked(console.error).mock.calls).toEqual([[line]]);
      expect(loggedCalls()).toHaveLength(1);
    },
  );

  // Only the class vouches for what it carries: a thrown value that merely has a `status`
  // or a `code` gets no suffix, and nothing that is not an error ever gets one.
  const lookAlikes: [string, unknown][] = [
    ['a plain object with a status', { status: 403 }],
    ['a plain object with a code', { code: 'invalid-input-secret' }],
    [
      'an Error given a status',
      Object.assign(new Error('boom'), { status: 403 }),
    ],
    [
      'an Error given a code',
      Object.assign(new Error('boom'), { code: 'invalid-input-secret' }),
    ],
    [
      'an Error subclass with a status',
      new (class extends Error {
        status = 403;
      })('boom'),
    ],
    [
      'an Error subclass with a code',
      new (class extends Error {
        code = 'bad-request';
      })('boom'),
    ],
    [
      'an Error that calls itself ProviderFailure, with a status',
      Object.assign(new Error('boom'), {
        name: 'ProviderFailure',
        status: 403,
      }),
    ],
    [
      'an Error that calls itself ProviderFailure, with a code',
      Object.assign(new Error('boom'), {
        name: 'ProviderFailure',
        code: 'internal-error',
      }),
    ],
    ['a string', 'HTTP 403'],
    ['a number', 403],
    ['null', null],
    ['undefined', undefined],
  ];

  const lookAlikeCases = closedSteps.flatMap(([step, line, , failWith]) =>
    lookAlikes.map(
      ([label, thrown]) =>
        [`${label}, thrown by ${step}`, line, failWith, thrown] as const,
    ),
  );

  it.each(lookAlikeCases)(
    'adds nothing for %s',
    async (_label, line, failWith, thrown) => {
      const f = fakes();
      failWith(f, thrown);

      await submitContact(submission(), f.deps, fromCloudflare());

      expect(vi.mocked(console.error).mock.calls).toEqual([[line]]);
      expect(loggedCalls()).toHaveLength(1);
    },
  );

  it.each(closedSteps)(
    'logs nothing a ProviderFailure says besides its status when %s fails',
    async (_step, line, _outcome, failWith) => {
      const f = fakes();
      const failure = Object.assign(
        new ProviderFailure('SECRET-message key=sentinel-key-q7', {
          status: 403,
        }),
        { cause: new Error('SECRET-cause'), detail: 'SECRET-detail' },
      );
      failWith(f, failure);

      await submitContact(submission(), f.deps, fromCloudflare());

      expect(vi.mocked(console.error).mock.calls).toEqual([
        [`${line} (HTTP 403)`],
      ]);
      expect(everythingLogged()).not.toContain('SECRET');
      expect(everythingLogged()).not.toContain('sentinel-key-q7');
    },
  );

  it.each(closedSteps)(
    'logs nothing a ProviderFailure says besides its code when %s fails',
    async (_step, line, _outcome, failWith) => {
      const f = fakes();
      const failure = Object.assign(
        new ProviderFailure('SECRET-message key=sentinel-key-q7', {
          code: 'invalid-input-secret',
        }),
        { cause: new Error('SECRET-cause'), detail: 'SECRET-detail' },
      );
      failWith(f, failure);

      await submitContact(submission(), f.deps, fromCloudflare());

      expect(vi.mocked(console.error).mock.calls).toEqual([
        [`${line} (invalid-input-secret)`],
      ]);
      expect(everythingLogged()).not.toContain('SECRET');
      expect(everythingLogged()).not.toContain('sentinel-key-q7');
    },
  );

  it('leaves the rate limiter line as it was, whatever the limiter rejects with', async () => {
    const f = fakes();
    f.rateLimiter.mockRejectedValue(
      new ProviderFailure('The limiter answered', { status: 503 }),
    );

    const outcome = await submitContact(submission(), f.deps, fromCloudflare());

    expect(outcome).toEqual({ kind: 'sent' });
    expect(vi.mocked(console.warn).mock.calls).toEqual([[LIMITER_LINE]]);
    expect(loggedCalls()).toHaveLength(1);
  });
});

// Whatever a dependency throws may quote the visitor's text, a token or a key (a failed
// request often echoes its own body), so neither the outcome nor the logs may carry it.
describe('submitContact: nothing private leaves through an outcome or a log', () => {
  const PRIVATE = {
    name: 'Sentinel-Name-Q7',
    email: 'sentinel.email.q7@example.com',
    message: 'Sentinel message body Q7',
    token: 'sentinel-token-q7',
    error: 'EMAILJS_PRIVATE_KEY=sentinel-key-q7',
  };

  const visitor = () =>
    submission({
      name: PRIVATE.name,
      email: PRIVATE.email,
      message: PRIVATE.message,
      'cf-turnstile-response': PRIVATE.token,
    });

  const failure = () =>
    Object.assign(new Error(PRIVATE.error), {
      cause: new Error(PRIVATE.error),
    });

  // The class itself, with the private text where an error could carry it.
  const providerFailure = () =>
    Object.assign(new ProviderFailure(PRIVATE.error, { status: 403 }), {
      cause: new Error(PRIVATE.error),
    });

  const failing: [string, (f: ReturnType<typeof fakes>) => void][] = [
    ['the rate limiter', (f) => f.rateLimiter.mockRejectedValue(failure())],
    ['the verifier', (f) => f.verifyTurnstile.mockRejectedValue(failure())],
    ['the sender', (f) => f.send.mockRejectedValue(failure())],
    [
      'the verifier, with a ProviderFailure',
      (f) => f.verifyTurnstile.mockRejectedValue(providerFailure()),
    ],
    [
      'the sender, with a ProviderFailure',
      (f) => f.send.mockRejectedValue(providerFailure()),
    ],
  ];

  it.each(failing)('holds when %s throws', async (_label, breakIt) => {
    const f = fakes();
    breakIt(f);

    const outcome = await submitContact(visitor(), f.deps, fromCloudflare());

    const visible = `${JSON.stringify(outcome)}\n${everythingLogged()}`;
    for (const secret of Object.values(PRIVATE)) {
      expect(visible).not.toContain(secret);
    }
  });

  it.each(failing)(
    'logs plain strings only, never an error object, when %s throws',
    async (_label, breakIt) => {
      const f = fakes();
      breakIt(f);

      await submitContact(visitor(), f.deps, fromCloudflare());

      const calls = consoleSpies.flatMap((spy) => spy.mock.calls);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call).toHaveLength(1);
        expect(typeof call[0]).toBe('string');
      }
    },
  );

  it('keeps the outcome to its kind alone', async () => {
    const f = fakes();
    f.send.mockRejectedValue(failure());

    const outcome = await submitContact(visitor(), f.deps, fromCloudflare());

    expect(Object.keys(outcome)).toEqual(['kind']);
  });
});
