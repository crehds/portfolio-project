import { describe, expect, it } from 'vitest';

import { clientIp, rateLimitKey } from './rate-limit-key';

const CLIENT_IP = '203.0.113.7';

/**
 * A `Headers` stand-in that returns the value exactly as given. A real `Headers` already
 * strips the spaces around a value when it is set, so on its own it cannot show that the
 * code under test trims.
 */
function rawHeaders(value: string) {
  return {
    get: (name: string) =>
      name.toLowerCase() === 'cf-connecting-ip' ? value : null,
  };
}

// Headers any client can write with whatever value it likes; unlike `cf-connecting-ip`,
// which Cloudflare sets itself, none of them proves where the request came from.
const SPOOFABLE = [
  'x-forwarded-for',
  'x-real-ip',
  'forwarded',
  'true-client-ip',
  'x-client-ip',
];

describe('clientIp', () => {
  it('reads the cf-connecting-ip header', () => {
    const headers = new Headers({ 'cf-connecting-ip': CLIENT_IP });

    expect(clientIp(headers)).toBe(CLIENT_IP);
  });

  it('does not care how the header name is cased', () => {
    const headers = new Headers({ 'CF-Connecting-IP': CLIENT_IP });

    expect(clientIp(headers)).toBe(CLIENT_IP);
  });

  it('trims the value', () => {
    expect(clientIp(rawHeaders(`  ${CLIENT_IP}\t`))).toBe(CLIENT_IP);
  });

  it('reads an IPv6 address as it came', () => {
    const headers = new Headers({ 'cf-connecting-ip': '2001:db8::1' });

    expect(clientIp(headers)).toBe('2001:db8::1');
  });

  it('is undefined when the header is absent', () => {
    expect(clientIp(new Headers())).toBeUndefined();
  });

  it.each([[''], ['   '], ['\t']])(
    'is undefined when the header is blank (%j)',
    (value) => {
      expect(clientIp(rawHeaders(value))).toBeUndefined();
    },
  );

  it.each(SPOOFABLE)('never falls back to %s', (name) => {
    const headers = new Headers({ [name]: '198.51.100.99' });

    expect(clientIp(headers)).toBeUndefined();
  });
});

describe('rateLimitKey', () => {
  it('is the client IP from cf-connecting-ip', () => {
    const headers = new Headers({ 'cf-connecting-ip': CLIENT_IP });

    expect(rateLimitKey(headers)).toBe(CLIENT_IP);
  });

  it('is the IP without the spaces around it', () => {
    expect(rateLimitKey(rawHeaders(` ${CLIENT_IP} `))).toBe(CLIENT_IP);
  });

  it('is the fixed key "unknown" when there is no cf-connecting-ip', () => {
    expect(rateLimitKey(new Headers())).toBe('unknown');
  });

  it('is the fixed key "unknown" when cf-connecting-ip is blank', () => {
    expect(rateLimitKey(rawHeaders('  '))).toBe('unknown');
  });

  it.each(SPOOFABLE)(
    'ignores %s, so a client cannot choose its own key',
    (name) => {
      const headers = new Headers({ [name]: '198.51.100.99' });

      expect(rateLimitKey(headers)).toBe('unknown');
    },
  );

  it.each(SPOOFABLE)(
    'still uses cf-connecting-ip when %s is sent too',
    (name) => {
      const headers = new Headers({
        [name]: '198.51.100.99',
        'cf-connecting-ip': CLIENT_IP,
      });

      expect(rateLimitKey(headers)).toBe(CLIENT_IP);
    },
  );
});
