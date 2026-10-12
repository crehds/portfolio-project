// The one source of the security headers. Pure: no `astro:*` or `cloudflare:*` import, so
// the middleware (on-demand routes), the generator of `public/_headers` (static pages and
// assets) and the tests all read the same text, and a unit test ties the committed
// `public/_headers` to `renderHeadersFile()` so the two cannot drift.
//
// Why two delivery paths: Workers static assets apply a `_headers` file to the responses
// they serve themselves (every prerendered page, every asset), never to a response the
// Worker generates (the contact pages, the Action's answer, `/cv/<locale>.pdf`).
// `src/middleware.ts` covers those.
//
// The policy relies on hashes, not nonces: the pages are prerendered, so a nonce would be
// baked into the HTML and reused by every visitor. Three scripts run inline, each written
// literally (`is:inline`, no interpolated value) so that its hash is stable. Astro-processed
// scripts would be inlined by Vite when small; there are none today, and the post-build
// check (`e2e/csp-hashes.spec.ts`) fails when one appears or an inline script changes.
// docs/security-headers.md says how to update a hash.

/** `<script is:inline>` in `src/layouts/BaseLayout.astro`: applies the theme before first paint. */
export const THEME_SCRIPT_HASH =
  'sha256-lY5qW8PnIfvk0+T3hWYX0iq170NuVAxtLuW80FePzGo=';

/** `<script is:inline>` in `src/components/ThemeToggle.astro`: syncs the button's `aria-pressed`. */
export const THEME_TOGGLE_SCRIPT_HASH =
  'sha256-Arm3enOEviotycgxTzHJqsEAMai9vGVrlrPJ1Wx8kls=';

/** `<script is:inline>` in `src/components/contact/ContactForm.astro`: gives the widget the site's theme. */
export const CONTACT_SCRIPT_HASH =
  'sha256-3e2tMrkIoRXTQ/WsCHgiuFLN6WksFhlFzUeTDXROONY=';

/** Where Turnstile's script, frame and requests come from. */
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/**
 * What a response is, for the policy it gets:
 * - `page`: a document or an asset of the site.
 * - `contact`: the contact page and the Action's answer, which load Turnstile.
 * - `file`: a download that is not a document of the site (the CV PDF).
 */
export type PolicyKind = 'page' | 'contact' | 'file';

/** The Content-Security-Policy of a kind of response. */
export function contentSecurityPolicy(kind: PolicyKind): string {
  if (kind === 'file') {
    return "default-src 'none'; frame-ancestors 'none'";
  }

  const contact = kind === 'contact';
  const scripts = [
    "'self'",
    `'${THEME_SCRIPT_HASH}'`,
    `'${THEME_TOGGLE_SCRIPT_HASH}'`,
    ...(contact ? [`'${CONTACT_SCRIPT_HASH}'`, TURNSTILE_ORIGIN] : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${scripts.join(' ')}`,
    // Inline styles stay allowed (Astro writes style attributes); scripts are the strict part.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${contact ? ` ${TURNSTILE_ORIGIN}` : ''}`,
    ...(contact ? [`frame-src ${TURNSTILE_ORIGIN}`] : []),
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * Every security header of a kind of response, in the order they are written.
 *
 * - HSTS has neither `includeSubDomains` nor `preload` until the site has a custom domain.
 * - No Cross-Origin-Embedder-Policy: it would block Turnstile's frame.
 * - `X-Frame-Options` repeats `frame-ancestors 'none'` for browsers that predate it.
 */
export function securityHeaders(kind: PolicyKind): [string, string][] {
  return [
    ['Content-Security-Policy', contentSecurityPolicy(kind)],
    ['Strict-Transport-Security', 'max-age=31536000'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    [
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    ],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['X-Frame-Options', 'DENY'],
  ];
}

const CONTACT_PATH = /^(?:\/es)?\/contact\/?$/;
const CV_PATH = /^\/cv\/[^/]+\.pdf$/;

/** The kind of response the Worker generates for a pathname. */
export function policyKindFor(pathname: string): PolicyKind {
  if (CONTACT_PATH.test(pathname)) {
    return 'contact';
  }

  return CV_PATH.test(pathname) ? 'file' : 'page';
}

/**
 * The text of `public/_headers`: one rule for every path, carrying the page headers. The
 * adapter appends its own immutable Cache-Control rule for `/_astro/*` at build time, and
 * Cloudflare merges the rules a path matches. Workers static assets accept 100 rules and
 * 2,000 characters a line; the longest line here is the policy.
 */
export function renderHeadersFile(): string {
  const lines = securityHeaders('page').map(
    ([name, value]) => `  ${name}: ${value}`,
  );

  return ['/*', ...lines, ''].join('\n');
}
