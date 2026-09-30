import { describe, expect, it } from 'vitest';

import { parseContactConfig } from './config';

const REQUIRED = [
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_PUBLIC_KEY',
  'EMAILJS_PRIVATE_KEY',
];

const SEAMS = ['EMAILJS_API_URL', 'TURNSTILE_VERIFY_URL'];

/** A value nobody would write by hand, so finding it in a result proves a value leaked. */
const SENTINEL = 'sentinel-7f3a9c-never-print-me';

/** Every required setting, each holding the sentinel plus its own name. */
function completeEnv(): Record<string, unknown> {
  return Object.fromEntries(
    REQUIRED.map((name) => [name, `${SENTINEL}-${name}`]),
  );
}

function without(env: Record<string, unknown>, name: string) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => key !== name),
  );
}

function succeeded(env: unknown) {
  const result = parseContactConfig(env);
  if (!result.ok) {
    throw new Error(
      `Expected the settings to be accepted: ${JSON.stringify(result)}`,
    );
  }
  return result.config;
}

function failed(env: unknown) {
  const result = parseContactConfig(env);
  if (result.ok) {
    throw new Error('Expected the settings to be rejected.');
  }
  return result;
}

describe('parseContactConfig: a valid environment', () => {
  it('groups each setting under the provider that uses it', () => {
    const config = succeeded({
      TURNSTILE_SITE_KEY: 'site-key',
      TURNSTILE_SECRET_KEY: 'secret-key',
      EMAILJS_SERVICE_ID: 'service-id',
      EMAILJS_TEMPLATE_ID: 'template-id',
      EMAILJS_PUBLIC_KEY: 'public-key',
      EMAILJS_PRIVATE_KEY: 'private-key',
      EMAILJS_API_URL: 'http://127.0.0.1:4332/emailjs/send',
      TURNSTILE_VERIFY_URL: 'https://turnstile.example/verify',
    });

    expect(config).toEqual({
      turnstile: {
        siteKey: 'site-key',
        secretKey: 'secret-key',
        verifyUrl: 'https://turnstile.example/verify',
      },
      emailjs: {
        serviceId: 'service-id',
        templateId: 'template-id',
        publicKey: 'public-key',
        privateKey: 'private-key',
        apiUrl: 'http://127.0.0.1:4332/emailjs/send',
      },
    });
  });

  it('leaves the optional test seams undefined when they are not set', () => {
    const config = succeeded(completeEnv());

    expect(config.turnstile.verifyUrl).toBeUndefined();
    expect(config.emailjs.apiUrl).toBeUndefined();
  });

  it('trims every value', () => {
    const config = succeeded({
      ...completeEnv(),
      EMAILJS_SERVICE_ID: '  service-id\n',
      EMAILJS_API_URL: ' https://emailjs.example/send ',
    });

    expect(config.emailjs.serviceId).toBe('service-id');
    expect(config.emailjs.apiUrl).toBe('https://emailjs.example/send');
  });

  it('ignores every entry that is not a contact setting', () => {
    const config = succeeded({
      ...completeEnv(),
      CV_BUCKET: { get: () => undefined },
      UNRELATED_SECRET: SENTINEL,
    });

    expect(Object.keys(config)).toEqual(['turnstile', 'emailjs']);
    expect(JSON.stringify(config)).not.toContain('UNRELATED_SECRET');
    expect(JSON.stringify(config)).not.toContain('CV_BUCKET');
  });
});

describe('parseContactConfig: required settings', () => {
  it.each(REQUIRED)('reports %s as missing when it is absent', (name) => {
    expect(failed(without(completeEnv(), name))).toEqual({
      ok: false,
      missing: [name],
      invalid: [],
    });
  });

  it.each(
    REQUIRED.flatMap((name) => [
      [name, ''],
      [name, '   '],
      [name, '\t\n'],
    ]),
  )('reports %s as missing when it is blank (%j)', (name, value) => {
    expect(failed({ ...completeEnv(), [name]: value })).toEqual({
      ok: false,
      missing: [name],
      invalid: [],
    });
  });

  it('reports a null setting as missing', () => {
    expect(failed({ ...completeEnv(), EMAILJS_PUBLIC_KEY: null })).toEqual({
      ok: false,
      missing: ['EMAILJS_PUBLIC_KEY'],
      invalid: [],
    });
  });

  it('reports every missing name, in declaration order', () => {
    expect(failed({})).toEqual({
      ok: false,
      missing: REQUIRED,
      invalid: [],
    });
  });

  it.each([[42], [true], [{ nested: SENTINEL }], [[SENTINEL]]])(
    'reports a setting that is not text as invalid (%j)',
    (value) => {
      expect(failed({ ...completeEnv(), EMAILJS_SERVICE_ID: value })).toEqual({
        ok: false,
        missing: [],
        invalid: ['EMAILJS_SERVICE_ID'],
      });
    },
  );
});

describe('parseContactConfig: the optional test seams', () => {
  it.each(
    SEAMS.flatMap((name) => [
      [name, ''],
      [name, '  '],
      [name, null],
    ]),
  )('treats a blank %s as unset (%j)', (name, value) => {
    const config = succeeded({ ...completeEnv(), [name]: value });

    expect(config.emailjs.apiUrl).toBeUndefined();
    expect(config.turnstile.verifyUrl).toBeUndefined();
  });

  it.each([
    'http://127.0.0.1:4332/emailjs/send',
    'https://api.example.com/v1/send',
  ])('accepts the http or https URL %s', (url) => {
    const config = succeeded({
      ...completeEnv(),
      EMAILJS_API_URL: url,
      TURNSTILE_VERIFY_URL: url,
    });

    expect(config.emailjs.apiUrl).toBe(url);
    expect(config.turnstile.verifyUrl).toBe(url);
  });

  it.each(
    SEAMS.flatMap((name) =>
      [
        'ftp://files.example/send',
        'javascript:alert(1)',
        'file:///etc/passwd',
        '//api.example.com/send',
        '/send',
        'not a url',
        42,
      ].map((value) => [name, value]),
    ),
  )('reports %s as invalid when it is %j', (name, value) => {
    expect(failed({ ...completeEnv(), [name]: value })).toEqual({
      ok: false,
      missing: [],
      invalid: [name],
    });
  });

  it('never reports a seam as missing', () => {
    expect(failed({}).missing).not.toContain('EMAILJS_API_URL');
    expect(failed({}).missing).not.toContain('TURNSTILE_VERIFY_URL');
  });

  it('reports missing and invalid settings together', () => {
    expect(
      failed({
        ...without(completeEnv(), 'EMAILJS_PRIVATE_KEY'),
        TURNSTILE_VERIFY_URL: 'ftp://files.example/verify',
      }),
    ).toEqual({
      ok: false,
      missing: ['EMAILJS_PRIVATE_KEY'],
      invalid: ['TURNSTILE_VERIFY_URL'],
    });
  });
});

describe('parseContactConfig: it reports names and never values', () => {
  it('keeps every value out of a failure, however the setting failed', () => {
    const result = parseContactConfig({
      ...without(completeEnv(), 'TURNSTILE_SECRET_KEY'),
      EMAILJS_SERVICE_ID: { leaked: SENTINEL },
      EMAILJS_API_URL: `ftp://${SENTINEL}.example/send`,
      TURNSTILE_VERIFY_URL: `${SENTINEL} is not a url`,
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it('carries nothing but the two lists in a failure', () => {
    const result = failed({ ...completeEnv(), EMAILJS_API_URL: 'nope' });

    // No Zod error, issue list or `cause` travels with the result.
    expect(Object.keys(result)).toEqual(['ok', 'missing', 'invalid']);
    expect(result.invalid).toEqual(['EMAILJS_API_URL']);
  });

  it('reports only known setting names', () => {
    const { missing, invalid } = failed({
      EMAILJS_API_URL: 'nope',
      [SENTINEL]: SENTINEL,
    });

    for (const name of [...missing, ...invalid]) {
      expect([...REQUIRED, ...SEAMS]).toContain(name);
    }
  });

  it.each([[undefined], [null], ['a string'], [42], [[]], [() => undefined]])(
    'does not throw for %j instead of an environment',
    (env) => {
      expect(failed(env)).toEqual({
        ok: false,
        missing: REQUIRED,
        invalid: [],
      });
    },
  );
});
