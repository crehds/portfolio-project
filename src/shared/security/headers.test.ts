import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CONTACT_SCRIPT_HASH,
  THEME_SCRIPT_HASH,
  THEME_TOGGLE_SCRIPT_HASH,
  contentSecurityPolicy,
  policyKindFor,
  renderHeadersFile,
  securityHeaders,
} from './headers';

/** The directives of a policy, by name, each as the list of its sources. */
function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name as string, sources];
    }),
  );
}

describe('contentSecurityPolicy', () => {
  describe('for a page', () => {
    const policy = directives(contentSecurityPolicy('page'));

    it('trusts only the site by default', () => {
      expect(policy.get('default-src')).toEqual(["'self'"]);
    });

    it('lets scripts come from the site and from the two inline scripts every page has, by hash', () => {
      expect(policy.get('script-src')).toEqual([
        "'self'",
        `'${THEME_SCRIPT_HASH}'`,
        `'${THEME_TOGGLE_SCRIPT_HASH}'`,
      ]);
    });

    it('never allows an inline script wholesale, or eval', () => {
      for (const kind of ['page', 'contact', 'file'] as const) {
        const sources = directives(contentSecurityPolicy(kind)).get(
          'script-src',
        );
        expect(sources ?? []).not.toContain("'unsafe-inline'");
        expect(sources ?? []).not.toContain("'unsafe-eval'");
      }
    });

    it('allows no other host in any directive', () => {
      expect(contentSecurityPolicy('page')).not.toContain('https:');
      expect(contentSecurityPolicy('page')).not.toContain('cloudflare');
    });

    it('forbids framing, a base element, plugins, and a form that posts away', () => {
      expect(policy.get('frame-ancestors')).toEqual(["'none'"]);
      expect(policy.get('base-uri')).toEqual(["'none'"]);
      expect(policy.get('object-src')).toEqual(["'none'"]);
      expect(policy.get('form-action')).toEqual(["'self'"]);
    });

    it('keeps images, fonts and requests on the site (images may be data: URIs)', () => {
      expect(policy.get('img-src')).toEqual(["'self'", 'data:']);
      expect(policy.get('font-src')).toEqual(["'self'"]);
      expect(policy.get('connect-src')).toEqual(["'self'"]);
    });

    it('allows inline styles, because Astro writes style attributes', () => {
      expect(policy.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    });

    it('upgrades insecure requests', () => {
      expect(policy.has('upgrade-insecure-requests')).toBe(true);
    });
  });

  describe('for the contact page', () => {
    const page = directives(contentSecurityPolicy('page'));
    const policy = directives(contentSecurityPolicy('contact'));

    it('adds Turnstile to scripts, frames and requests, and the hash of its own inline script', () => {
      expect(policy.get('script-src')).toEqual([
        ...(page.get('script-src') as string[]),
        `'${CONTACT_SCRIPT_HASH}'`,
        'https://challenges.cloudflare.com',
      ]);
      expect(policy.get('frame-src')).toEqual([
        'https://challenges.cloudflare.com',
      ]);
      expect(policy.get('connect-src')).toEqual([
        "'self'",
        'https://challenges.cloudflare.com',
      ]);
    });

    it('is otherwise the page policy', () => {
      for (const name of [
        'default-src',
        'style-src',
        'img-src',
        'font-src',
        'base-uri',
        'object-src',
        'form-action',
        'frame-ancestors',
        'upgrade-insecure-requests',
      ]) {
        expect(policy.get(name)).toEqual(page.get(name));
      }
    });

    it('is the only policy that names Turnstile', () => {
      expect(contentSecurityPolicy('page')).not.toContain('challenges');
      expect(contentSecurityPolicy('file')).not.toContain('challenges');
    });
  });

  describe('for a file', () => {
    it('allows nothing, and forbids framing', () => {
      expect(contentSecurityPolicy('file')).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
    });
  });
});

describe('securityHeaders', () => {
  const kinds = ['page', 'contact', 'file'] as const;

  it.each(kinds)('sends the same fixed headers with the %s policy', (kind) => {
    const headers = Object.fromEntries(securityHeaders(kind));

    expect(headers).toEqual({
      'Content-Security-Policy': contentSecurityPolicy(kind),
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy':
        'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
    });
  });

  it('does not commit to a custom domain: no subdomains, no preload', () => {
    const hsts = Object.fromEntries(securityHeaders('page'))[
      'Strict-Transport-Security'
    ];
    expect(hsts).not.toMatch(/includeSubDomains|preload/i);
  });

  it('sets no Cross-Origin-Embedder-Policy, which would break Turnstile', () => {
    for (const kind of kinds) {
      const names = securityHeaders(kind).map(([name]) => name.toLowerCase());
      expect(names).not.toContain('cross-origin-embedder-policy');
    }
  });
});

describe('policyKindFor', () => {
  it.each([
    ['/contact', 'contact'],
    ['/contact/', 'contact'],
    ['/es/contact', 'contact'],
    ['/es/contact/', 'contact'],
    ['/cv/en.pdf', 'file'],
    ['/cv/es.pdf', 'file'],
    ['/cv/nope.pdf', 'file'],
    ['/', 'page'],
    ['/es/', 'page'],
    ['/projects/', 'page'],
    ['/no-such-page', 'page'],
    ['/contactable', 'page'],
    ['/es/contact/other', 'page'],
    ['/cv', 'page'],
  ])('%s gets the %s policy', (pathname, kind) => {
    expect(policyKindFor(pathname)).toBe(kind);
  });
});

describe('renderHeadersFile', () => {
  it('has one rule for every path, with the page headers indented under it', () => {
    const lines = renderHeadersFile().split('\n');

    expect(lines[0]).toBe('/*');
    for (const [name, value] of securityHeaders('page')) {
      expect(lines).toContain(`  ${name}: ${value}`);
    }
  });

  it('stays inside the limits of Workers static assets: 100 rules, 2,000 characters a line', () => {
    const lines = renderHeadersFile().split('\n');

    expect(lines.filter((line) => /^\S/.test(line)).length).toBeLessThanOrEqual(
      100,
    );
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThan(2000);
  });

  it('is exactly what public/_headers holds, so the file and the module cannot drift', () => {
    const file = readFileSync(
      new URL('../../../public/_headers', import.meta.url),
      'utf8',
    );

    expect(file).toBe(renderHeadersFile());
  });
});
