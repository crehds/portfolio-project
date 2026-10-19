// Pure: no `astro:*` or `cloudflare:*` import. The Worker's `env` arrives as a parameter
// (the composition roots read it from `cloudflare:workers`), and so does `fetch`, so
// Vitest drives all of this with plain objects and a fake `fetch`.
import {
  OPTIONAL_CONTACT_SETTINGS,
  REQUIRED_CONTACT_SETTINGS,
  parseContactConfig,
  type ContactSettingName,
} from '../config';
import type { ContactDeps } from '../domain/submit-contact';
import { createEmailJsSender } from './emailjs-email-sender';
import type { Fetch } from './outbound';
import { createTurnstileVerifier } from './turnstile-verifier';
import {
  createWorkersRateLimiter,
  type RateLimitBinding,
} from './workers-rate-limiter';

/**
 * The Workers Rate Limiting binding the form counts requests in. It is a binding, not a
 * setting, so `parseContactConfig` does not read it; it is checked here.
 */
const RATE_LIMIT_BINDING = 'CONTACT_RATE_LIMIT' as const;

/** What a failure can name: a contact setting, or the rate-limit binding. */
export type ContactRequirementName =
  ContactSettingName | typeof RATE_LIMIT_BINDING;

/**
 * What became of wiring the contact form. A failure lists NAMES only, never a value: it is
 * meant to be logged and shown to the owner, and these settings are secrets.
 *
 * - `missing`: required settings that are absent, null or blank, and the binding when
 *   `env` has none.
 * - `invalid`: settings set to something unusable, and the binding when it is set but is
 *   not a rate limiter (it has no `limit` function).
 */
export type CreateContactDepsResult =
  | {
      readonly ok: true;
      readonly deps: ContactDeps;
      /** Public: the widget on the contact page renders with it. */
      readonly siteKey: string;
    }
  | {
      readonly ok: false;
      readonly missing: readonly ContactRequirementName[];
      readonly invalid: readonly ContactRequirementName[];
    };

const READ_FROM_ENV: readonly string[] = [
  ...REQUIRED_CONTACT_SETTINGS,
  ...OPTIONAL_CONTACT_SETTINGS,
  RATE_LIMIT_BINDING,
];

/**
 * Copies the entries the form reads out of `env` into a plain object, each read once. An
 * `env` that is not an object has none, and an entry whose read throws (a getter that
 * does) is treated as not set: it is then named as missing, and the error, which could
 * say anything, goes nowhere. Everything after this step works on plain data.
 */
function snapshotOf(env: unknown): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};

  if (typeof env !== 'object' || env === null) {
    return snapshot;
  }

  for (const name of READ_FROM_ENV) {
    try {
      snapshot[name] = (env as Record<string, unknown>)[name];
    } catch {
      // Unreadable counts as not set.
    }
  }

  return snapshot;
}

type BindingState =
  | { readonly state: 'ready'; readonly binding: RateLimitBinding }
  | { readonly state: 'missing' }
  | { readonly state: 'invalid' };

function readRateLimitBinding(
  entries: Readonly<Record<string, unknown>>,
): BindingState {
  const value = entries[RATE_LIMIT_BINDING];

  if (value === undefined || value === null) {
    return { state: 'missing' };
  }

  if (
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { limit?: unknown }).limit === 'function'
  ) {
    return { state: 'ready', binding: value as RateLimitBinding };
  }

  return { state: 'invalid' };
}

/**
 * Builds the contact form's three dependencies from the Worker's `env`, or says which
 * settings stand in the way. It is the one place that knows which provider fulfils which
 * port, and the composition roots (the Action and the contact page) call it with the
 * `env` from `cloudflare:workers` and show the "write me instead" notice when it fails.
 *
 * - The settings are read by `parseContactConfig` and the `CONTACT_RATE_LIMIT` binding is
 *   checked beside them, all in one pass, so a misconfigured deploy is named in full
 *   instead of one problem at a time. A binding that is not there is a missing setting
 *   named `CONTACT_RATE_LIMIT`; one that is there without a `limit` function is invalid.
 * - It never throws and never logs; what to say about a failure is the root's call, and
 *   the names are all a failure carries. An entry of `env` that cannot be read counts as
 *   not set.
 * - It makes no request. Each adapter calls out only when it is used, through `fetchImpl`
 *   (the runtime's `fetch` when none is given), and gets only its own slice of the
 *   settings: the EmailJS sender never sees the Turnstile secret, nor the other way round.
 *
 * Where a failing dependency is logged: nowhere in the adapters. Each one rejects with
 * fixed text, and an answer that is not a success adds one closed detail as a
 * `ProviderFailure`: the HTTP status, or the fault code of a Turnstile answer that blames
 * the request. `submitContact` logs one line per failure, the fixed text for the step plus
 * that detail, so a failure is reported once and no error text reaches a log or the
 * browser.
 */
export function createContactDeps(
  env: unknown,
  fetchImpl?: Fetch,
): CreateContactDepsResult {
  const entries = snapshotOf(env);
  const config = parseContactConfig(entries);
  const limiter = readRateLimitBinding(entries);

  if (!config.ok || limiter.state !== 'ready') {
    return {
      ok: false,
      missing: [
        ...(config.ok ? [] : config.missing),
        ...(limiter.state === 'missing' ? [RATE_LIMIT_BINDING] : []),
      ],
      invalid: [
        ...(config.ok ? [] : config.invalid),
        ...(limiter.state === 'invalid' ? [RATE_LIMIT_BINDING] : []),
      ],
    };
  }

  return {
    ok: true,
    siteKey: config.config.turnstile.siteKey,
    deps: {
      emailSender: createEmailJsSender(config.config.emailjs, fetchImpl),
      verifyTurnstile: createTurnstileVerifier(
        config.config.turnstile,
        fetchImpl,
      ),
      rateLimiter: createWorkersRateLimiter(limiter.binding),
    },
  };
}
