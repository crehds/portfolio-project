import { describe, expect, it } from 'vitest';

import {
  ProviderFailure,
  TURNSTILE_FAULT_CODES,
  failureSuffix,
  type TurnstileFaultCode,
} from './provider-failure';

describe('ProviderFailure: what it is', () => {
  it('is an Error named ProviderFailure that keeps the message it was given', () => {
    const failure = new ProviderFailure('EmailJS answered HTTP 403', {
      status: 403,
    });

    expect(failure).toBeInstanceOf(Error);
    expect(failure.name).toBe('ProviderFailure');
    expect(failure.message).toBe('EmailJS answered HTTP 403');
  });
});

describe('ProviderFailure: the HTTP status', () => {
  // 100 and 599 are the ends of the range an HTTP status can take.
  it.each([100, 200, 302, 403, 429, 500, 503, 599])(
    'keeps the status %i',
    (status) => {
      const failure = new ProviderFailure('m', { status });

      expect(failure.status).toBe(status);
    },
  );

  // A value that is not an HTTP status is dropped, not kept: what a failure carries is
  // printed in a log line, so only a real status may ride along.
  it.each([
    ['a number below the range', 99],
    ['a number above the range', 600],
    ['zero', 0],
    ['a negative number', -403],
    ['a fraction', 403.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a numeric string', '403'],
    ['text', 'HTTP 403'],
    ['null', null],
    ['undefined', undefined],
  ])('drops a status that is %s', (_label, status) => {
    const failure = new ProviderFailure('m', { status: status as number });

    expect(failure.status).toBeUndefined();
    expect('status' in failure).toBe(false);
  });

  it('carries nothing but its name and the status', () => {
    const failure = new ProviderFailure('m', { status: 403 });

    expect(Object.keys(failure).sort()).toEqual(['name', 'status']);
  });

  it('never carries a cause, whatever the detail object holds', () => {
    const detail = { status: 403, cause: new Error('SECRET-cause') };

    const failure = new ProviderFailure('m', detail);

    expect(failure.cause).toBeUndefined();
    expect('cause' in failure).toBe(false);
  });
});

// The error codes in a Siteverify answer that blame the request or Turnstile itself, never
// the visitor's token. Their order is the priority the Turnstile verifier uses.
describe('TURNSTILE_FAULT_CODES', () => {
  it('lists the four codes that blame the secret, the request or Turnstile, in priority order', () => {
    expect([...TURNSTILE_FAULT_CODES]).toEqual([
      'missing-input-secret',
      'invalid-input-secret',
      'bad-request',
      'internal-error',
    ]);
  });

  it.each([
    'missing-input-response',
    'invalid-input-response',
    'timeout-or-duplicate',
  ])('leaves out %s, a code that blames the token', (code) => {
    expect(TURNSTILE_FAULT_CODES).not.toContain(code);
  });
});

describe('ProviderFailure: the Turnstile fault code', () => {
  it.each([
    'missing-input-secret',
    'invalid-input-secret',
    'bad-request',
    'internal-error',
  ] as const)('keeps the code %s', (code) => {
    const failure = new ProviderFailure('m', { code });

    expect(failure.code).toBe(code);
    expect(failure.status).toBeUndefined();
    expect('status' in failure).toBe(false);
  });

  // The code comes out of Turnstile's JSON, so the types cannot vouch for it: it is checked
  // at run time, against the list and against nothing else.
  it.each([
    ['a code that blames the token', 'invalid-input-response'],
    ['another code that blames the token', 'timeout-or-duplicate'],
    ['a code nobody listed', 'some-future-error'],
    ['a listed code in another case', 'Invalid-Input-Secret'],
    ['a listed code with a space before it', ' bad-request'],
    ['a listed code with text after it', 'bad-request secret=abc'],
    ['a name from Object.prototype', 'constructor'],
    ['empty text', ''],
    ['a number', 42],
    ['null', null],
    ['undefined', undefined],
    ['an array that holds a listed code', ['bad-request']],
    [
      'an object that prints as a listed code',
      { toString: (): string => 'bad-request' },
    ],
  ])('drops a code that is %s', (_label, code) => {
    const failure = new ProviderFailure('m', {
      code: code as TurnstileFaultCode,
    });

    expect(failure.code).toBeUndefined();
    expect('code' in failure).toBe(false);
  });

  it('carries nothing but its name and the code', () => {
    const failure = new ProviderFailure('m', { code: 'bad-request' });

    expect(Object.keys(failure).sort()).toEqual(['code', 'name']);
  });

  it('never carries a cause, whatever the detail object holds', () => {
    const detail = {
      code: 'bad-request' as const,
      cause: new Error('SECRET-cause'),
    };

    const failure = new ProviderFailure('m', detail);

    expect(failure.cause).toBeUndefined();
    expect('cause' in failure).toBe(false);
  });
});

describe('ProviderFailure: at most one detail', () => {
  // The types forbid giving both, so these casts stand in for a caller that ignores them.
  it('keeps the status and drops the code when it is given both', () => {
    const failure = new ProviderFailure('m', {
      status: 403,
      code: 'bad-request',
    } as never);

    expect(failure.status).toBe(403);
    expect('code' in failure).toBe(false);
  });

  it('keeps the code when the status it came with was not valid', () => {
    const failure = new ProviderFailure('m', {
      status: 99,
      code: 'bad-request',
    } as never);

    expect(failure.code).toBe('bad-request');
    expect('status' in failure).toBe(false);
  });
});

describe('failureSuffix', () => {
  it('names the HTTP status of a ProviderFailure', () => {
    expect(failureSuffix(new ProviderFailure('m', { status: 403 }))).toBe(
      ' (HTTP 403)',
    );
  });

  it.each([
    'missing-input-secret',
    'invalid-input-secret',
    'bad-request',
    'internal-error',
  ] as const)('names the code %s of a ProviderFailure', (code) => {
    expect(failureSuffix(new ProviderFailure('m', { code }))).toBe(
      ` (${code})`,
    );
  });

  it('is empty for a ProviderFailure that kept no detail', () => {
    expect(failureSuffix(new ProviderFailure('m', { status: 99 }))).toBe('');
    expect(
      failureSuffix(
        new ProviderFailure('m', {
          code: 'invalid-input-response' as TurnstileFaultCode,
        }),
      ),
    ).toBe('');
  });

  it.each([
    ['a plain Error', new Error('EmailJS answered HTTP 403')],
    ['a TypeError', new TypeError('fetch failed')],
    ['a DOMException', new DOMException('timed out', 'TimeoutError')],
  ])('is empty for %s', (_label, error) => {
    expect(failureSuffix(error)).toBe('');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'EmailJS answered HTTP 403'],
    ['a number', 403],
    ['an empty object', {}],
    ['an array', [403]],
  ])('is empty for a value that is not an error: %s', (_label, value) => {
    expect(failureSuffix(value)).toBe('');
  });

  // Only the class vouches for what its properties hold. Anything else that happens to
  // have a `status` or a `code` is not trusted, whatever it looks like.
  it.each([
    ['a plain object with a status', { status: 403 }],
    ['a plain object with a code', { code: 'invalid-input-secret' }],
    [
      'a plain Error given a status',
      Object.assign(new Error('x'), { status: 403 }),
    ],
    [
      'a plain Error given a code',
      Object.assign(new Error('x'), { code: 'bad-request' }),
    ],
    [
      'an Error subclass with a status',
      new (class extends Error {
        status = 403;
      })('x'),
    ],
    [
      'an Error subclass with a code',
      new (class extends Error {
        code = 'bad-request';
      })('x'),
    ],
    [
      'an Error that calls itself ProviderFailure, with a status',
      Object.assign(new Error('x'), { name: 'ProviderFailure', status: 403 }),
    ],
    [
      'an Error that calls itself ProviderFailure, with a code',
      Object.assign(new Error('x'), {
        name: 'ProviderFailure',
        code: 'internal-error',
      }),
    ],
    [
      'a system error with a code of its own',
      Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    ],
  ])('is empty for a look-alike: %s', (_label, lookAlike) => {
    expect(failureSuffix(lookAlike)).toBe('');
  });

  it('does not read a single property of what is not a ProviderFailure', () => {
    const trap = {
      get status(): number {
        throw new Error('the status was read');
      },
      get code(): string {
        throw new Error('the code was read');
      },
      get message(): string {
        throw new Error('the message was read');
      },
    };

    expect(failureSuffix(trap)).toBe('');
  });

  // The properties are `readonly` for the compiler only. The suffix goes into a log, so
  // it re-checks what it prints instead of trusting an instance that was changed later.
  it.each([
    ['below the range', 99],
    ['above the range', 600],
    ['a fraction', 403.5],
    ['NaN', Number.NaN],
    ['text', 'SECRET-status'],
    ['an object', { toString: (): string => 'SECRET-status' }],
  ])('prints nothing when the status was changed to %s', (_label, status) => {
    const failure = new ProviderFailure('m', { status: 403 });
    Object.assign(failure, { status });

    expect(failureSuffix(failure)).toBe('');
  });

  it.each([
    ['a code that blames the token', 'invalid-input-response'],
    ['a listed code in another case', 'BAD-REQUEST'],
    ['text', 'SECRET-code'],
    ['an object', { toString: (): string => 'bad-request' }],
  ])('prints nothing when the code was changed to %s', (_label, code) => {
    const failure = new ProviderFailure('m', { code: 'bad-request' });
    Object.assign(failure, { code });

    expect(failureSuffix(failure)).toBe('');
  });

  it('prints one detail at most, the status, even if an instance was changed to hold both', () => {
    const failure = new ProviderFailure('m', { status: 403 });
    Object.assign(failure, { code: 'bad-request' });

    expect(failureSuffix(failure)).toBe(' (HTTP 403)');
  });
});
