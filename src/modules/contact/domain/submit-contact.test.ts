import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EmailSender, RateLimiter, TurnstileVerifier } from '../ports';
import { contactSchema } from '../schema';
import { submitContact, type ContactDeps } from './submit-contact';

const CLIENT_IP = '203.0.113.7';
const TOKEN = 'turnstile-token-abc';

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

  const failing: [string, (f: ReturnType<typeof fakes>) => void][] = [
    ['the rate limiter', (f) => f.rateLimiter.mockRejectedValue(failure())],
    ['the verifier', (f) => f.verifyTurnstile.mockRejectedValue(failure())],
    ['the sender', (f) => f.send.mockRejectedValue(failure())],
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
