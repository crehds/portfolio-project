// The crawl behind `e2e/links.spec.ts`: it visits every page of the site in the browser,
// collects what each one links to or loads, and judges every reference with the pure rules
// in `src/shared/links`. It reports problems as text instead of asserting, so one run lists
// every broken link, not just the first.
import type { APIRequestContext, Page } from '@playwright/test';

import { classifyHref } from '../../src/shared/links/classify-href';
import {
  externalProblem,
  mailtoProblem,
  telProblem,
} from '../../src/shared/links/check-href';
import { ALLOWED_EXTERNAL_HOSTS } from '../../src/shared/links/external-hosts';
import { SITE_URL } from '../../src/shared/site/site-url';

// An address with no page behind it answers 404 with the error page of its locale
// (not-found.spec.ts). The sitemap leaves the error pages out, so they are named here.
const NOT_FOUND_PATHS = ['/no-such-page', '/es/no-such-page'];

/**
 * One reference found in a page's markup, with its value as written (not resolved).
 * A `link` is an `<a href>`: the allowlist applies to those. A `resource` is anything the
 * page loads or declares (`link[href]`, `img`, `script`, `srcset`, the social card): when it
 * leaves the site it must still be https, but which hosts a page may load from is the
 * Content-Security-Policy's business (`src/shared/security/headers.ts`).
 */
interface Reference {
  kind: 'link' | 'resource';
  /** What it was found on, for the message: `a[href]`, `img[src]`, ... */
  source: string;
  value: string;
}

export interface CrawlResult {
  /** The paths visited. */
  pages: string[];
  /** How many references of each kind were judged, so the spec can tell the crawl looked. */
  seen: Record<'internal' | 'fragment' | 'mailto' | 'tel' | 'external', number>;
  /** One line per problem, naming the page, the link and what is wrong with it. */
  problems: string[];
}

/** Every `<loc>` of a sitemap document. */
function locsOf(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc = '']) => loc);
}

/** The path of an absolute address on the site. */
function sitePath(address: string): string {
  const classified = classifyHref(address, `${SITE_URL}/`, SITE_URL);
  if (classified.kind !== 'internal') {
    throw new Error(
      `The sitemap lists ${address}, which is not on ${SITE_URL}.`,
    );
  }
  return new URL(classified.path, SITE_URL).pathname;
}

/**
 * The paths the server's sitemap lists, followed from its index. The server is asked, not
 * `dist/`: the build the tests run against is the one that is serving, and a missing sitemap
 * fails here with its address.
 */
async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  async function read(path: string): Promise<string> {
    const response = await request.get(path, { maxRedirects: 0 });
    if (response.status() !== 200) {
      throw new Error(
        `Expected the sitemap at ${path}, but the server answered ${response.status()}.`,
      );
    }
    return response.text();
  }

  const index = await read('/sitemap-index.xml');
  const paths = new Set<string>();
  for (const sitemap of locsOf(index)) {
    for (const loc of locsOf(await read(sitePath(sitemap)))) {
      paths.add(sitePath(loc));
    }
  }
  return [...paths];
}

/** Everything a page links to or loads, read from the markup as the browser parsed it. */
function collectReferences(page: Page): Promise<Reference[]> {
  return page.evaluate(() => {
    const found: Reference[] = [];
    const add = (
      kind: 'link' | 'resource',
      source: string,
      value: string | null | undefined,
    ) => {
      if (value != null) found.push({ kind, source, value });
    };

    for (const el of document.querySelectorAll('a[href]')) {
      add('link', 'a[href]', el.getAttribute('href'));
    }
    for (const [selector, attribute] of [
      ['link[href]', 'href'],
      ['img[src]', 'src'],
      ['source[src]', 'src'],
      ['script[src]', 'src'],
      ['iframe[src]', 'src'],
      ['meta[property="og:image"]', 'content'],
      ['meta[name="twitter:image"]', 'content'],
    ] as const) {
      for (const el of document.querySelectorAll(selector)) {
        add('resource', selector, el.getAttribute(attribute));
      }
    }
    // `srcset` is a comma-separated list of `URL [descriptor]`.
    for (const el of document.querySelectorAll('[srcset]')) {
      for (const candidate of (el.getAttribute('srcset') ?? '').split(',')) {
        add('resource', '[srcset]', candidate.trim().split(/\s+/)[0]);
      }
    }
    return found;
  });
}

function idsOf(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[id]')].map((el) => el.id),
  );
}

/**
 * Visits every page and judges every reference. Internal targets are requested once each,
 * without following a redirect: the site uses none for a link (the only redirect it makes
 * answers a POST to the contact form, which no page links to), so any 3xx is a problem.
 * The CV PDFs come from the locally seeded R2 bucket the e2e run starts with.
 */
export async function checkAllLinks(
  page: Page,
  request: APIRequestContext,
): Promise<CrawlResult> {
  const listed = await sitemapPaths(request);
  const paths = [...listed, ...NOT_FOUND_PATHS];

  const problems = new Set<string>();
  const seen: CrawlResult['seen'] = {
    internal: 0,
    fragment: 0,
    mailto: 0,
    tel: 0,
    external: 0,
  };

  const references = new Map<string, Reference[]>();
  const ids = new Map<string, Set<string>>();
  for (const path of paths) {
    await page.goto(path);
    references.set(path, await collectReferences(page));
    ids.set(path, new Set(await idsOf(page)));
  }

  // One request per distinct target: `null` when it answers 200, else what went wrong.
  const statusProblems = new Map<string, string | null>();
  async function statusProblem(path: string): Promise<string | null> {
    if (!statusProblems.has(path)) {
      const response = await request.get(path, { maxRedirects: 0 });
      const status = response.status();
      const location = response.headers()['location'];
      statusProblems.set(
        path,
        status === 200
          ? null
          : `answers ${status}${location ? ` (redirects to ${location})` : ''}, not 200`,
      );
    }
    return statusProblems.get(path) ?? null;
  }

  // The ids of a page the crawl did not visit, found by visiting it once.
  async function idsAt(path: string): Promise<Set<string>> {
    let found = ids.get(path);
    if (!found) {
      await page.goto(path);
      found = new Set(await idsOf(page));
      ids.set(path, found);
    }
    return found;
  }

  for (const path of listed) {
    const problem = await statusProblem(path);
    if (problem) {
      problems.add(`${path}: the sitemap lists it, but it ${problem}`);
    }
  }

  for (const path of paths) {
    const pageUrl = new URL(path, SITE_URL).href;
    for (const { kind, source, value } of references.get(path) ?? []) {
      const where = `${path}: ${source} ${JSON.stringify(value)}`;
      const link = classifyHref(value, pageUrl, SITE_URL);

      if (link.kind === 'internal') {
        seen.internal += 1;
        // A link to the page it is on needs no request: the browser just loaded it (an error
        // page answers 404 and is still the page).
        const problem =
          link.path === path ? null : await statusProblem(link.path);
        if (problem) {
          problems.add(`${where}: the target ${link.path} ${problem}`);
        } else if (link.fragment !== null) {
          seen.fragment += 1;
          const targetIds = await idsAt(new URL(link.path, SITE_URL).pathname);
          if (!targetIds.has(link.fragment)) {
            problems.add(
              `${where}: no element with id ${JSON.stringify(link.fragment)} on ${link.path}`,
            );
          }
        }
      } else if (link.kind === 'mailto') {
        seen.mailto += 1;
        const problem = mailtoProblem(link.value);
        if (problem) problems.add(`${where}: ${problem}`);
      } else if (link.kind === 'tel') {
        seen.tel += 1;
        const problem = telProblem(link.value);
        if (problem) problems.add(`${where}: ${problem}`);
      } else if (link.kind === 'external') {
        seen.external += 1;
        const problem =
          kind === 'link'
            ? externalProblem(link.protocol, link.host, ALLOWED_EXTERNAL_HOSTS)
            : link.protocol === 'https:'
              ? null
              : `${link.protocol.replace(/:$/, '')} is not https (host ${link.host})`;
        if (problem) problems.add(`${where}: ${problem}`);
      } else if (link.kind === 'other') {
        problems.add(`${where}: the ${link.protocol} scheme is not supported`);
      } else {
        problems.add(`${where}: not a valid address`);
      }
    }
  }

  return { pages: paths, seen, problems: [...problems] };
}
