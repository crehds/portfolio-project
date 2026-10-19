import { z } from 'astro/zod';

import { isPlainHostname, normalizeHostname } from './allowed-hostname';

/** The settings the contact form cannot work without. */
export const REQUIRED_CONTACT_SETTINGS = [
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_PRIVATE_KEY',
] as const;

/**
 * Settings the form works without. `EMAILJS_API_URL` and `TURNSTILE_VERIFY_URL` are test
 * seams: they replace a provider's endpoint so the end-to-end tests can point the Worker
 * at a fake server (left blank, each provider's own endpoint is used).
 * `TURNSTILE_ALLOWED_HOSTNAMES` adds hosts a Turnstile token may be solved on.
 */
export const OPTIONAL_CONTACT_SETTINGS = [
  'EMAILJS_API_URL',
  'TURNSTILE_VERIFY_URL',
  'TURNSTILE_ALLOWED_HOSTNAMES',
] as const;

export type ContactSettingName =
  | (typeof REQUIRED_CONTACT_SETTINGS)[number]
  | (typeof OPTIONAL_CONTACT_SETTINGS)[number];

/**
 * The validated settings, grouped by provider so each adapter takes only its own slice
 * (the email sender never sees the Turnstile secret, and the other way around).
 */
export interface ContactConfig {
  readonly turnstile: {
    /** Public: the widget on the contact page uses it. */
    readonly siteKey: string;
    readonly secretKey: string;
    /** A test seam; `undefined` means Turnstile's own verification endpoint. */
    readonly verifyUrl: string | undefined;
    /**
     * Hosts beyond `DEFAULT_ALLOWED_HOSTNAME` that a token may be solved on (their
     * subdomains too), plain and lowercase. Empty when the setting is not set.
     */
    readonly allowedHostnames: readonly string[];
  };
  readonly emailjs: {
    readonly serviceId: string;
    readonly templateId: string;
    readonly publicKey: string;
    readonly privateKey: string;
    /** A test seam; `undefined` means EmailJS's own send endpoint. */
    readonly apiUrl: string | undefined;
  };
}

/**
 * The outcome of reading the settings. A failure lists setting NAMES only, never a value:
 * the result is meant to be logged and shown to the owner, and these settings are secrets.
 */
export type ContactConfigResult =
  | { readonly ok: true; readonly config: ContactConfig }
  | {
      readonly ok: false;
      /** Required settings that are absent, null or blank. */
      readonly missing: readonly ContactSettingName[];
      /** Settings that are set to something unusable (not text, or a bad URL). */
      readonly invalid: readonly ContactSettingName[];
    };

// Internal issue messages. They are this file's own words, not Zod's defaults, and they
// only ever decide which list a name joins: no message is ever returned.
const MISSING = 'missing';
const INVALID = 'invalid';

/** An absent, null or blank setting is "not set"; text is trimmed, anything else stays. */
function normalize(value: unknown): unknown {
  if (value === null) return undefined;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

const requiredText = z.preprocess(
  normalize,
  z.string({
    // After `normalize`, `undefined` means nothing usable was set; any other non-text
    // value is set, but to something that cannot be a key or an id.
    error: (issue) => (issue.input === undefined ? MISSING : INVALID),
  }),
);

/**
 * The hosts an `http:` seam URL may name: the machine's own loopback address, which is
 * where the end-to-end harness serves its fakes. Compared against `URL.hostname`, which
 * the parser lowercases and which keeps the brackets around an IPv6 address.
 */
const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '[::1]'];

/**
 * `https:` for any host, `http:` for a loopback host only. A seam URL receives a secret in
 * its request (the EmailJS private key, the Turnstile secret key), so a plain-text hop to
 * any other machine would expose it. The host is read from the parsed URL, never from the
 * text, so `http://localhost@example.com` (userinfo, host `example.com`) and
 * `http://127.0.0.1.example.com` are not loopback. A text `new URL` cannot parse is not a
 * URL and is rejected rather than thrown on.
 */
function isHttpsOrLoopbackUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);

    return (
      protocol === 'https:' ||
      (protocol === 'http:' && LOOPBACK_HOSTS.includes(hostname))
    );
  } catch {
    return false;
  }
}

// One schema with one issue per failure: a separate `z.url()` next to this check would
// report an unparseable value twice, and `parseContactConfig` lists each name once.
const optionalSeamUrl = z.preprocess(
  normalize,
  z
    .string({ error: INVALID })
    .refine(isHttpsOrLoopbackUrl, { error: INVALID })
    .optional(),
);

/**
 * A comma-separated list of hostnames: each entry is trimmed, lowercased and loses one
 * trailing dot, and empty entries are skipped, so blank means an empty list. One entry
 * that is not a plain hostname (a URL, a wildcard, a port) makes the whole setting
 * invalid: a typo must show up as a named setting, not as a host that quietly matches
 * nothing.
 */
const hostnameList = z.preprocess(
  normalize,
  z
    .string({ error: INVALID })
    .transform((text) =>
      text
        .split(',')
        .map((entry) => normalizeHostname(entry.trim()))
        .filter((entry) => entry !== ''),
    )
    .refine((entries) => entries.every(isPlainHostname), { error: INVALID })
    .optional(),
);

const settingsSchema = z
  .object({
    TURNSTILE_SITE_KEY: requiredText,
    TURNSTILE_SECRET_KEY: requiredText,
    EMAILJS_SERVICE_ID: requiredText,
    EMAILJS_TEMPLATE_ID: requiredText,
    EMAILJS_PUBLIC_KEY: requiredText,
    EMAILJS_PRIVATE_KEY: requiredText,
    EMAILJS_API_URL: optionalSeamUrl,
    TURNSTILE_VERIFY_URL: optionalSeamUrl,
    TURNSTILE_ALLOWED_HOSTNAMES: hostnameList,
  })
  .transform((settings): ContactConfig => ({
    turnstile: {
      siteKey: settings.TURNSTILE_SITE_KEY,
      secretKey: settings.TURNSTILE_SECRET_KEY,
      verifyUrl: settings.TURNSTILE_VERIFY_URL,
      allowedHostnames: settings.TURNSTILE_ALLOWED_HOSTNAMES ?? [],
    },
    emailjs: {
      serviceId: settings.EMAILJS_SERVICE_ID,
      templateId: settings.EMAILJS_TEMPLATE_ID,
      publicKey: settings.EMAILJS_PUBLIC_KEY,
      privateKey: settings.EMAILJS_PRIVATE_KEY,
      apiUrl: settings.EMAILJS_API_URL,
    },
  }));

const SETTING_NAMES: readonly unknown[] = [
  ...REQUIRED_CONTACT_SETTINGS,
  ...OPTIONAL_CONTACT_SETTINGS,
];

function isSettingName(value: unknown): value is ContactSettingName {
  return SETTING_NAMES.includes(value);
}

function isSettingsBag(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the contact settings from the Worker's `env` (or any object holding them) and
 * checks them in one pass, so a misconfigured deploy is named instead of failing on a
 * visitor's first submission. It never throws, and a failure carries setting names only:
 * Zod's issues are read for the name and the kind of problem, then dropped, so nothing
 * from the input can travel with the result. The `CONTACT_RATE_LIMIT` binding is not a
 * setting and is checked where it is wired.
 */
export function parseContactConfig(env: unknown): ContactConfigResult {
  const result = settingsSchema.safeParse(isSettingsBag(env) ? env : {});

  if (result.success) {
    return { ok: true, config: result.data };
  }

  const missing: ContactSettingName[] = [];
  const invalid: ContactSettingName[] = [];

  for (const issue of result.error.issues) {
    const name = issue.path[0];
    if (isSettingName(name)) {
      (issue.message === MISSING ? missing : invalid).push(name);
    }
  }

  return { ok: false, missing, invalid };
}
