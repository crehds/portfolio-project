import { describe, expect, it } from 'vitest';

import { ProviderFailure, failureSuffix } from './provider-failure';

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

describe('failureSuffix', () => {
  it('names the HTTP status of a ProviderFailure', () => {
    expect(failureSuffix(new ProviderFailure('m', { status: 403 }))).toBe(
      ' (HTTP 403)',
    );
  });

  it('is empty for a ProviderFailure that kept no detail', () => {
    expect(failureSuffix(new ProviderFailure('m', { status: 99 }))).toBe('');
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
  // have a `status` is not trusted, whatever it looks like.
  it.each([
    ['a plain object', { status: 403 }],
    [
      'a plain Error given a status',
      Object.assign(new Error('x'), { status: 403 }),
    ],
    [
      'an Error subclass with a status',
      new (class extends Error {
        status = 403;
      })('x'),
    ],
    [
      'an Error that calls itself ProviderFailure',
      Object.assign(new Error('x'), { name: 'ProviderFailure', status: 403 }),
    ],
  ])('is empty for a look-alike: %s', (_label, lookAlike) => {
    expect(failureSuffix(lookAlike)).toBe('');
  });

  it('does not read a single property of what is not a ProviderFailure', () => {
    const trap = {
      get status(): number {
        throw new Error('the status was read');
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
    ['an object', { toString: () => 'SECRET-status' }],
  ])('prints nothing when the status was changed to %s', (_label, status) => {
    const failure = new ProviderFailure('m', { status: 403 });
    Object.assign(failure, { status });

    expect(failureSuffix(failure)).toBe('');
  });
});
