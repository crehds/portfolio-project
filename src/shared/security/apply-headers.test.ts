import { describe, expect, it } from 'vitest';

import { applySecurityHeaders } from './apply-headers';
import { contentSecurityPolicy, securityHeaders } from './headers';

describe('applySecurityHeaders', () => {
  it('adds every header of the route to the response', () => {
    const response = applySecurityHeaders('/contact/', new Response('hi'));

    for (const [name, value] of securityHeaders('contact')) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it('picks the policy by route: contact, file, page', () => {
    const csp = (pathname: string) =>
      applySecurityHeaders(pathname, new Response('x')).headers.get(
        'Content-Security-Policy',
      );

    expect(csp('/es/contact')).toBe(contentSecurityPolicy('contact'));
    expect(csp('/cv/en.pdf')).toBe(contentSecurityPolicy('file'));
    expect(csp('/anything-else')).toBe(contentSecurityPolicy('page'));
  });

  it('keeps the status, the status text, the body and the headers it had', async () => {
    const original = new Response('the body', {
      status: 418,
      statusText: 'Teapot',
      headers: {
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'Content-Type': 'application/pdf',
        ETag: '"abc"',
      },
    });

    const response = applySecurityHeaders('/cv/en.pdf', original);

    expect(response.status).toBe(418);
    expect(response.statusText).toBe('Teapot');
    expect(await response.text()).toBe('the body');
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=300, must-revalidate',
    );
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('ETag')).toBe('"abc"');
  });

  it('keeps several Set-Cookie headers apart', () => {
    const original = new Response(null, { status: 303 });
    original.headers.append('Set-Cookie', 'a=1; Path=/');
    original.headers.append('Set-Cookie', 'b=2; Path=/');

    const response = applySecurityHeaders('/contact/', original);

    expect(response.headers.getSetCookie()).toEqual([
      'a=1; Path=/',
      'b=2; Path=/',
    ]);
  });

  it('works on a response whose headers cannot be changed, such as a redirect', () => {
    const redirect = Response.redirect(
      'https://example.com/contact/?sent=1',
      303,
    );

    const response = applySecurityHeaders('/contact/', redirect);

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      'https://example.com/contact/?sent=1',
    );
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('keeps a status without a body, 304, without a body', () => {
    const response = applySecurityHeaders(
      '/cv/en.pdf',
      new Response(null, { status: 304, headers: { ETag: '"abc"' } }),
    );

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
    expect(response.headers.get('ETag')).toBe('"abc"');
  });

  it('replaces a header of the same name that the route set itself', () => {
    const response = applySecurityHeaders(
      '/',
      new Response('x', {
        headers: { 'Content-Security-Policy': 'default-src *' },
      }),
    );

    expect(response.headers.get('Content-Security-Policy')).toBe(
      contentSecurityPolicy('page'),
    );
  });
});
