import { describe, expect, it } from 'vitest';

import { classifyHref } from './classify-href';

const SITE = 'https://site.example';
const PAGE = `${SITE}/projects/pysa/`;

const classify = (href: string) => classifyHref(href, PAGE, SITE);

describe('classifyHref: internal links', () => {
  it.each([
    ['/cv/en.pdf', '/cv/en.pdf'],
    ['/es/', '/es/'],
    ['/contact/?sent=1', '/contact/?sent=1'],
    // Resolved against the page that holds the link, the way a browser does.
    ['../', '/projects/'],
    ['other/', '/projects/pysa/other/'],
    ['', '/projects/pysa/'],
  ])('resolves %j to the path %j', (href, path) => {
    expect(classify(href)).toEqual({ kind: 'internal', path, fragment: null });
  });

  // The pitfall of `isExternalHref`: an absolute URL to the site's own origin (a canonical
  // link, an hreflang alternate, a social card) is external there, but it is this site.
  it.each([
    [`${SITE}/projects/`, '/projects/'],
    [`${SITE}`, '/'],
    [`${SITE}/es/?x=1`, '/es/?x=1'],
    ['//site.example/cv/es.pdf', '/cv/es.pdf'],
    [`HTTPS://SITE.EXAMPLE/icon.svg`, '/icon.svg'],
  ])(
    'treats the absolute address %j on the site as internal: %j',
    (href, path) => {
      expect(classify(href)).toEqual({
        kind: 'internal',
        path,
        fragment: null,
      });
    },
  );

  it('reads the fragment, on this page and on another', () => {
    expect(classify('#main')).toEqual({
      kind: 'internal',
      path: '/projects/pysa/',
      fragment: 'main',
    });
    expect(classify('/contact/#contact-name')).toEqual({
      kind: 'internal',
      path: '/contact/',
      fragment: 'contact-name',
    });
  });

  it('decodes a percent-encoded fragment, as the browser matches it', () => {
    expect(classify('#a%20b')).toMatchObject({ fragment: 'a b' });
  });

  // `#` and `#top` scroll to the top of the document without any element, by the HTML spec.
  it.each(['#', '#top', '#TOP'])('needs no id for %j', (href) => {
    expect(classify(href)).toMatchObject({ kind: 'internal', fragment: null });
  });

  it('keeps a malformed escape in the fragment as written', () => {
    expect(classify('#100%')).toMatchObject({ fragment: '100%' });
  });
});

describe('classifyHref: other kinds', () => {
  it('reads a mailto: link without the scheme', () => {
    expect(classify('mailto:a@b.co?subject=Hi')).toEqual({
      kind: 'mailto',
      value: 'a@b.co?subject=Hi',
    });
    expect(classify('MAILTO:a@b.co')).toEqual({
      kind: 'mailto',
      value: 'a@b.co',
    });
  });

  it('reads a tel: link without the scheme', () => {
    expect(classify('tel:+51970791041')).toEqual({
      kind: 'tel',
      value: '+51970791041',
    });
  });

  it('reads an address on another host as external', () => {
    expect(classify('https://github.com/crehds')).toEqual({
      kind: 'external',
      protocol: 'https:',
      host: 'github.com',
    });
    expect(classify('http://github.com/crehds')).toMatchObject({
      kind: 'external',
      protocol: 'http:',
    });
    // Same name, other scheme: not this origin.
    expect(classify('http://site.example/')).toMatchObject({
      kind: 'external',
    });
    // A host that only starts with the site's.
    expect(classify('https://site.example.evil.test/')).toMatchObject({
      kind: 'external',
      host: 'site.example.evil.test',
    });
  });

  it.each(['javascript:void(0)', 'data:text/plain,hi', 'ftp://site.example/f'])(
    'flags the scheme of %j as unsupported',
    (href) => {
      expect(classify(href)).toMatchObject({ kind: 'other' });
    },
  );

  it('flags what does not parse as invalid', () => {
    expect(classify('http://')).toEqual({ kind: 'invalid' });
  });
});
