import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALLOWED_HOSTNAME,
  isAllowedHostname,
  isPlainHostname,
  normalizeHostname,
} from './allowed-hostname';

describe('isAllowedHostname: the default host', () => {
  it.each([
    DEFAULT_ALLOWED_HOSTNAME,
    'www.carlos15erh.workers.dev',
    'portfolio-project.carlos15erh.workers.dev',
    'a1b2c3d4-portfolio-project.carlos15erh.workers.dev',
    'a.b.carlos15erh.workers.dev',
  ])('accepts %s', (hostname) => {
    expect(isAllowedHostname(hostname)).toBe(true);
  });

  it.each([
    'Carlos15erh.Workers.Dev',
    'PORTFOLIO-PROJECT.CARLOS15ERH.WORKERS.DEV',
    'carlos15erh.workers.dev.',
    'portfolio-project.carlos15erh.workers.dev.',
  ])('accepts %s (any case, one trailing dot)', (hostname) => {
    expect(isAllowedHostname(hostname)).toBe(true);
  });

  it.each([
    ['a prefix glued to the host', 'evilcarlos15erh.workers.dev'],
    ['the host as a label of another', 'carlos15erh.workers.dev.attacker.com'],
    ['a hyphen in place of the dot', 'carlos15erh-workers.dev'],
    ['the parent domain', 'workers.dev'],
    ['another account on workers.dev', 'someone-else.workers.dev'],
    ['the host after an at sign', 'attacker.com@carlos15erh.workers.dev'],
    ['the host in a path', 'attacker.com/carlos15erh.workers.dev'],
    ['the host with a port', 'carlos15erh.workers.dev:443'],
    ['the host as a URL', 'https://carlos15erh.workers.dev'],
    ['the host with a space', 'carlos15erh.workers.dev '],
    ['two trailing dots', 'carlos15erh.workers.dev..'],
    ['an empty label', '.carlos15erh.workers.dev'],
    ['an empty label inside', 'a..carlos15erh.workers.dev'],
    ['an underscore label', 'a_b.carlos15erh.workers.dev'],
    ['a newline', 'a.carlos15erh.workers.dev\nevil.com'],
    ['a non-ASCII look-alike', 'carlos15erh.workers.devа'],
    ['an empty string', ''],
    ['a lone dot', '.'],
  ])('rejects %s', (_label, hostname) => {
    expect(isAllowedHostname(hostname)).toBe(false);
  });

  it.each([[undefined], [null], [42], [{}], [['carlos15erh.workers.dev']]])(
    'rejects %j, which is not text',
    (hostname) => {
      expect(isAllowedHostname(hostname)).toBe(false);
    },
  );
});

describe('isAllowedHostname: the optional hosts', () => {
  const extra = ['example.com', 'my-site.dev'];

  it('allows a listed host and its subdomains', () => {
    expect(isAllowedHostname('example.com', extra)).toBe(true);
    expect(isAllowedHostname('www.Example.COM.', extra)).toBe(true);
    expect(isAllowedHostname('my-site.dev', extra)).toBe(true);
  });

  it('keeps the default host allowed next to them', () => {
    expect(isAllowedHostname('carlos15erh.workers.dev', extra)).toBe(true);
  });

  it('rejects look-alikes of a listed host', () => {
    expect(isAllowedHostname('evilexample.com', extra)).toBe(false);
    expect(isAllowedHostname('example.com.attacker.com', extra)).toBe(false);
    expect(isAllowedHostname('example-com', extra)).toBe(false);
    expect(isAllowedHostname('com', extra)).toBe(false);
  });

  it('allows nothing extra when the list is empty', () => {
    expect(isAllowedHostname('example.com', [])).toBe(false);
    expect(isAllowedHostname('example.com')).toBe(false);
  });

  it('never lets a malformed hostname through, whatever the list holds', () => {
    expect(isAllowedHostname('', [''])).toBe(false);
    expect(isAllowedHostname('.example.com', extra)).toBe(false);
  });
});

describe('isPlainHostname', () => {
  it.each([
    'localhost',
    'example.com',
    'a-b.example.com',
    '127.0.0.1',
    'xn--bcher-kva.example',
    'a'.repeat(63) + '.com',
  ])('accepts %s', (value) => {
    expect(isPlainHostname(value)).toBe(true);
  });

  it.each([
    '',
    '-a.com',
    'a-.com',
    'a..com',
    '.com',
    'a.com.',
    'a b.com',
    '*.example.com',
    'example.com:443',
    'a'.repeat(64) + '.com',
    Array(130).fill('ab').join('.'),
  ])('rejects %j', (value) => {
    expect(isPlainHostname(value)).toBe(false);
  });
});

describe('normalizeHostname', () => {
  it('lowercases and drops one trailing dot', () => {
    expect(normalizeHostname('Example.COM.')).toBe('example.com');
  });

  it('keeps a second trailing dot, so the result is not a plain hostname', () => {
    expect(normalizeHostname('example.com..')).toBe('example.com.');
  });
});
