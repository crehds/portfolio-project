// The end-to-end tests submit the contact form, and the Worker that answers would send a
// real email through EmailJS (200 requests a month, every one into the owner's inbox) and
// ask the real Turnstile, if it ran with a developer's own `.dev.vars` instead of
// `.dev.vars.e2e`. That is easy to do by accident: the Cloudflare plugin picks the file
// when it BUILDS (`CLOUDFLARE_ENV=e2e` selects `.dev.vars.e2e`, and without it the
// developer's `.dev.vars` wins) and copies it into `dist/server/.dev.vars`, which is all
// `astro preview` reads afterwards.
//
// So the check is on what the server will read, and it needs no request: a request that
// proved the point would itself be the one that reached a provider. It runs in
// `globalSetup`, before the first test, and throws, so a misconfigured run stops before
// anything is submitted.
//
// A problem names settings and never prints a value: the build may hold a developer's real
// keys, and the message ends up in a terminal and in CI logs.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EMAILJS_PATH, TURNSTILE_PATH, UPSTREAM_ORIGIN } from './ports';

export const E2E_VARS_FILE = '.dev.vars.e2e';

/**
 * Cloudflare's published Turnstile test keys. A real key is none of these.
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TURNSTILE_TEST_SITE_KEYS: readonly string[] = [
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
];

const TURNSTILE_TEST_SECRET_KEYS: readonly string[] = [
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
];

/** The fake values, which all start the same way so that no real one can pass for them. */
const FAKE_PREFIX = 'e2e-';

const FAKE_EMAILJS_SETTINGS = [
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_PRIVATE_KEY',
] as const;

/** Where each seam must point: the fake upstreams, never a provider. */
const SEAMS: Readonly<Record<string, string>> = {
  EMAILJS_API_URL: `${UPSTREAM_ORIGIN}${EMAILJS_PATH}`,
  TURNSTILE_VERIFY_URL: `${UPSTREAM_ORIGIN}${TURNSTILE_PATH}`,
};

const EXPECTED_SETTINGS: readonly string[] = [
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  ...FAKE_EMAILJS_SETTINGS,
  ...Object.keys(SEAMS),
];

/**
 * Reads the `KEY=VALUE` lines of a `.dev.vars` file the way wrangler does for the cases
 * that matter here: comments and blank lines are skipped, and a value in single quotes,
 * double quotes or back ticks (the plugin writes single quotes) loses them.
 */
export function parseDevVars(text: string): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator < 1) {
      continue;
    }

    const name = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    const quote = raw[0];
    const quoted =
      raw.length >= 2 &&
      (quote === "'" || quote === '"' || quote === '`') &&
      raw.endsWith(quote);

    vars[name] = quoted ? raw.slice(1, -1) : raw.split(' #')[0].trim();
  }

  return vars;
}

/** What is wrong with the committed `.dev.vars.e2e`, as a list of problems (names only). */
export function e2eVarsProblems(
  vars: Readonly<Record<string, string>>,
): string[] {
  const problems: string[] = [];

  for (const name of EXPECTED_SETTINGS) {
    if (!vars[name]) {
      problems.push(`${E2E_VARS_FILE} has no ${name}.`);
    }
  }

  for (const name of Object.keys(vars)) {
    if (!EXPECTED_SETTINGS.includes(name)) {
      problems.push(
        `${E2E_VARS_FILE} has ${name}, which the end-to-end tests do not use. ` +
          `Only the settings the contact form reads belong in it.`,
      );
    }
  }

  const siteKey = vars.TURNSTILE_SITE_KEY;
  if (siteKey && !TURNSTILE_TEST_SITE_KEYS.includes(siteKey)) {
    problems.push(
      `TURNSTILE_SITE_KEY in ${E2E_VARS_FILE} is not one of Cloudflare's published Turnstile test keys.`,
    );
  }

  const secretKey = vars.TURNSTILE_SECRET_KEY;
  if (secretKey && !TURNSTILE_TEST_SECRET_KEYS.includes(secretKey)) {
    problems.push(
      `TURNSTILE_SECRET_KEY in ${E2E_VARS_FILE} is not one of Cloudflare's published Turnstile test keys.`,
    );
  }

  for (const name of FAKE_EMAILJS_SETTINGS) {
    const value = vars[name];
    if (value && !value.startsWith(FAKE_PREFIX)) {
      problems.push(
        `${name} in ${E2E_VARS_FILE} does not start with "${FAKE_PREFIX}", so it could be a real value.`,
      );
    }
  }

  for (const [name, expected] of Object.entries(SEAMS)) {
    const value = vars[name];
    if (value && value !== expected) {
      problems.push(
        `${name} in ${E2E_VARS_FILE} must be ${expected}, the fake upstream; anything else is a provider.`,
      );
    }
  }

  return problems;
}

/**
 * What is wrong with the build the server will run, as a list of problems (names only).
 * `wranglerJson` and `bakedVars` are `undefined` when the file is not there.
 */
export function buildOutputProblems(args: {
  wranglerJson: unknown;
  bakedVars: Readonly<Record<string, string>> | undefined;
  e2eVars: Readonly<Record<string, string>>;
}): string[] {
  const problems: string[] = [];
  const { wranglerJson, bakedVars, e2eVars } = args;

  if (wranglerJson === undefined) {
    problems.push(
      'dist/server/wrangler.json is missing: build the site with CLOUDFLARE_ENV=e2e first.',
    );
  } else if (
    (wranglerJson as { targetEnvironment?: unknown } | null)
      ?.targetEnvironment !== 'e2e'
  ) {
    problems.push(
      'The build was not made with CLOUDFLARE_ENV=e2e (dist/server/wrangler.json does not target ' +
        'the e2e environment), so it holds the developer’s .dev.vars instead of ' +
        `${E2E_VARS_FILE}. Rebuild with CLOUDFLARE_ENV=e2e.`,
    );
  }

  if (bakedVars === undefined) {
    problems.push(
      'dist/server/.dev.vars is missing: the build baked in no settings, so the Worker has none.',
    );
    return problems;
  }

  const onlyInBuild = Object.keys(bakedVars).filter(
    (name) => !(name in e2eVars),
  );
  const onlyInFile = Object.keys(e2eVars).filter(
    (name) => !(name in bakedVars),
  );
  const different = Object.keys(e2eVars).filter(
    (name) => name in bakedVars && bakedVars[name] !== e2eVars[name],
  );

  if (onlyInBuild.length > 0) {
    problems.push(
      `The build holds settings that are not in ${E2E_VARS_FILE}: ${onlyInBuild.join(', ')}.`,
    );
  }
  if (onlyInFile.length > 0) {
    problems.push(
      `The build lost settings that are in ${E2E_VARS_FILE}: ${onlyInFile.join(', ')}.`,
    );
  }
  if (different.length > 0) {
    problems.push(
      `The build holds other values than ${E2E_VARS_FILE} for: ${different.join(', ')}.`,
    );
  }

  return problems;
}

const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function readIfThere(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

/**
 * Throws, with every problem at once, unless the committed `.dev.vars.e2e` holds nothing
 * but test and fake values and the build in `dist/` was made with it. `root` is the
 * repository; the default is this repository.
 */
export function assertHermeticBuild(root: string = REPOSITORY_ROOT): void {
  const e2eText = readIfThere(path.join(root, E2E_VARS_FILE));
  if (e2eText === undefined) {
    throw new Error(
      `${E2E_VARS_FILE} is missing: without it the Worker would run with the developer's own settings.`,
    );
  }

  const e2eVars = parseDevVars(e2eText);

  const wranglerText = readIfThere(
    path.join(root, 'dist', 'server', 'wrangler.json'),
  );
  let wranglerJson: unknown;
  if (wranglerText !== undefined) {
    try {
      wranglerJson = JSON.parse(wranglerText);
    } catch {
      throw new Error('dist/server/wrangler.json is not valid JSON.');
    }
  }

  const bakedText = readIfThere(path.join(root, 'dist', 'server', '.dev.vars'));

  const problems = [
    ...e2eVarsProblems(e2eVars),
    ...buildOutputProblems({
      wranglerJson,
      bakedVars: bakedText === undefined ? undefined : parseDevVars(bakedText),
      e2eVars,
    }),
  ];

  if (problems.length > 0) {
    throw new Error(
      `The end-to-end run is not hermetic, so it stops before anything is submitted:\n` +
        problems.map((problem) => `  - ${problem}`).join('\n'),
    );
  }
}
