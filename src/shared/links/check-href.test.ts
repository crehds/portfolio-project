import { describe, expect, it } from 'vitest';

import { ALLOWED_EXTERNAL_HOSTS } from './external-hosts';
import { externalProblem, mailtoProblem, telProblem } from './check-href';

describe('mailtoProblem', () => {
  it.each([
    'carlos15erh@gmail.com',
    'a.b+tag@sub.example.co',
    'a@b.co?subject=Hello%20there&body=Hi',
    'a@b.co,c@d.org',
    'a%40b.co',
  ])('accepts %j', (value) => {
    expect(mailtoProblem(value)).toBeNull();
  });

  it.each([
    '',
    '?subject=Hi',
    'no-at-sign.example',
    'a@',
    '@b.co',
    'a@b',
    'a@b..co',
    'a b@c.co',
    'a@b.co,',
    'a@b.co;c@d.org',
    '%E0%A4%A@b.co',
  ])('rejects %j', (value) => {
    expect(mailtoProblem(value)).toEqual(expect.any(String));
  });
});

describe('telProblem', () => {
  it.each(['+51970791041', '+14155552671', '+442071838750'])(
    'accepts the E.164 number %j',
    (value) => {
      expect(telProblem(value)).toBeNull();
    },
  );

  it.each([
    '',
    '51970791041',
    '+0970791041',
    '+519',
    '+1234567890123456',
    '+51 970 791 041',
    '+51-970-791-041',
    '+51970791041;ext=1',
    'abc',
  ])('rejects %j', (value) => {
    expect(telProblem(value)).toEqual(expect.any(String));
  });
});

describe('externalProblem', () => {
  const allowed = ['github.com', 'wa.me'];

  it('accepts an https address on the list', () => {
    expect(externalProblem('https:', 'github.com', allowed)).toBeNull();
  });

  it('ignores the case of the host', () => {
    expect(externalProblem('https:', 'GitHub.com', allowed)).toBeNull();
  });

  it('rejects http even on a listed host', () => {
    expect(externalProblem('http:', 'github.com', allowed)).toMatch(/https/);
  });

  it('rejects a host that is not listed, and names it', () => {
    expect(externalProblem('https:', 'evil.test', allowed)).toMatch(
      /evil\.test/,
    );
  });

  it('does not take a subdomain or a longer name for a listed host', () => {
    expect(externalProblem('https:', 'api.github.com', allowed)).not.toBeNull();
    expect(
      externalProblem('https:', 'github.com.evil.test', allowed),
    ).not.toBeNull();
  });
});

describe('ALLOWED_EXTERNAL_HOSTS', () => {
  it('holds bare lowercase host names, once each', () => {
    for (const host of ALLOWED_EXTERNAL_HOSTS) {
      expect(host).toMatch(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/);
    }
    expect(new Set(ALLOWED_EXTERNAL_HOSTS).size).toBe(
      ALLOWED_EXTERNAL_HOSTS.length,
    );
  });
});
