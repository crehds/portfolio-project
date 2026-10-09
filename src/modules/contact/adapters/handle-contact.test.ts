import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { contactSchema } from '../schema';
import { createContactDeps } from './create-contact-deps';
import { handleContact } from './handle-contact';
import type { Fetch } from './outbound';
import { forbidRealFetch, spyOnConsole } from './testing';
import type { RateLimitBinding } from './workers-rate-limiter';

// Every test injects a fake `fetch` and a fake rate-limit binding. Nothing here reaches
// EmailJS, Turnstile or Cloudflare.

/** A value nobody would write by hand, so finding it in a log proves a value leaked. */
const SENTINEL = 'sentinel-3c9e1b-never-print-me';

const SETTINGS = {
  TURNSTILE_SITE_KEY: 'site-key-public-1',
  TURNSTILE_SECRET_KEY: 'turnstile-secret-sentinel-2',
  EMAILJS_SERVICE_ID: 'service-id-sentinel-3',
  EMAILJS_TEMPLATE_ID: 'template-id-sentinel-4',
  EMAILJS_PUBLIC_KEY: 'public-key-sentinel-5',
  EMAILJS_PRIVATE_KEY: 'private-key-sentinel-6',
};

const NOT_CONFIGURED_LINE =
  'contact: the form is not configured, so the submission was answered unavailable';

let consoleSpies: ReturnType<typeof spyOnConsole>;

beforeEach(() => {
  forbidRealFetch();
  consoleSpies = spyOnConsole();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openBinding() {
  return {
    limit: vi.fn<RateLimitBinding['limit']>(async () => ({ success: true })),
  };
}

function completeEnv(overrides: Record<string, unknown> = {}) {
  return { ...SETTINGS, CONTACT_RATE_LIMIT: openBinding(), ...overrides };
}

function without(env: Record<string, unknown>, ...names: string[]) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !names.includes(key)),
  );
}

/** Turnstile and EmailJS as they answer when all is well. */
function providers() {
  return vi.fn<Fetch>(async (url) =>
    url.includes('siteverify')
      ? new Response(JSON.stringify({ success: true }), { status: 200 })
      : new Response('OK', { status: 200 }),
  );
}

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
    headers: { 'cf-connecting-ip': '203.0.113.7' },
  }),
});

/** Every console call as its text, whatever the method. */
function logged() {
  return consoleSpies.flatMap((spy) =>
    spy.mock.calls.map((call) => call.join(' ')),
  );
}

describe('handleContact: the form is configured', () => {
  it('submits through the wired dependencies and reports the outcome', async () => {
    const fetchFake = providers();
    const wiring = createContactDeps(completeEnv(), fetchFake);

    const outcome = await handleContact(submission(), wiring, context());

    expect(outcome).toEqual({ kind: 'sent' });
    expect(fetchFake).toHaveBeenCalledTimes(2);
  });

  it('logs nothing for a submission that goes through', async () => {
    const wiring = createContactDeps(completeEnv(), providers());

    await handleContact(submission(), wiring, context());

    expect(logged()).toEqual([]);
  });

  it('passes on the outcome of a step that failed, as submitContact decides it', async () => {
    const binding = {
      limit: vi.fn<RateLimitBinding['limit']>(async () => ({ success: false })),
    };
    const fetchFake = providers();
    const wiring = createContactDeps(
      completeEnv({ CONTACT_RATE_LIMIT: binding }),
      fetchFake,
    );

    const outcome = await handleContact(submission(), wiring, context());

    expect(outcome).toEqual({ kind: 'rate_limited' });
    expect(fetchFake).not.toHaveBeenCalled();
  });
});

describe('handleContact: the form is not configured', () => {
  it('answers unavailable and calls no dependency when a setting is missing', async () => {
    const fetchFake = providers();
    const binding = openBinding();
    const wiring = createContactDeps(
      without(
        completeEnv({ CONTACT_RATE_LIMIT: binding }),
        'EMAILJS_PRIVATE_KEY',
      ),
      fetchFake,
    );

    const outcome = await handleContact(submission(), wiring, context());

    expect(outcome).toEqual({ kind: 'unavailable' });
    expect(fetchFake).not.toHaveBeenCalled();
    expect(binding.limit).not.toHaveBeenCalled();
  });

  it('answers unavailable when the rate limit binding is missing', async () => {
    const fetchFake = providers();
    const wiring = createContactDeps(
      without(completeEnv(), 'CONTACT_RATE_LIMIT'),
      fetchFake,
    );

    expect(await handleContact(submission(), wiring, context())).toEqual({
      kind: 'unavailable',
    });
    expect(fetchFake).not.toHaveBeenCalled();
  });

  it('answers unavailable for an environment that is not an object', async () => {
    const wiring = createContactDeps(undefined, providers());

    expect(await handleContact(submission(), wiring, context())).toEqual({
      kind: 'unavailable',
    });
  });

  it('logs one fixed line that names what is missing and what is invalid', async () => {
    const wiring = createContactDeps(
      without(
        completeEnv({ EMAILJS_API_URL: 'http://evil.example/send' }),
        'EMAILJS_PRIVATE_KEY',
        'CONTACT_RATE_LIMIT',
      ),
      providers(),
    );

    await handleContact(submission(), wiring, context());

    expect(vi.mocked(console.error).mock.calls).toEqual([
      [
        `${NOT_CONFIGURED_LINE} (missing: EMAILJS_PRIVATE_KEY, CONTACT_RATE_LIMIT; invalid: EMAILJS_API_URL)`,
      ],
    ]);
    expect(logged()).toHaveLength(1);
  });

  it('says none for a list that is empty', async () => {
    const wiring = createContactDeps(
      without(completeEnv(), 'TURNSTILE_SECRET_KEY'),
      providers(),
    );

    await handleContact(submission(), wiring, context());

    expect(logged()).toEqual([
      `${NOT_CONFIGURED_LINE} (missing: TURNSTILE_SECRET_KEY; invalid: none)`,
    ]);
  });

  it('logs names only, never a value, whatever the settings hold', async () => {
    const wiring = createContactDeps(
      completeEnv({
        TURNSTILE_SECRET_KEY: '   ',
        EMAILJS_PRIVATE_KEY: SENTINEL,
        EMAILJS_API_URL: `http://evil.example/${SENTINEL}`,
        TURNSTILE_VERIFY_URL: 42,
      }),
      providers(),
    );

    await handleContact(submission(), wiring, context());

    expect(logged().join('\n')).not.toContain(SENTINEL);
    for (const value of Object.values(SETTINGS)) {
      expect(logged().join('\n')).not.toContain(value);
    }
  });

  it('logs plain text only, never an error object', async () => {
    const wiring = createContactDeps({}, providers());

    await handleContact(submission(), wiring, context());

    const calls = consoleSpies.flatMap((spy) => spy.mock.calls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(1);
    expect(typeof calls[0][0]).toBe('string');
  });

  it('keeps the outcome to its kind alone', async () => {
    const wiring = createContactDeps({}, providers());

    const outcome = await handleContact(submission(), wiring, context());

    expect(Object.keys(outcome)).toEqual(['kind']);
  });
});
