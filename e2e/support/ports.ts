// Where the end-to-end tests put their two servers. Both are fixed, so that
// `.dev.vars.e2e` (a committed file the Worker reads) can name the second one.

/**
 * The site under test: `astro preview` of a build made with `CLOUDFLARE_ENV=e2e`. A port
 * of its own, not Astro's 4321, so that a developer's `astro dev` (which reads their real
 * `.dev.vars`) can never be mistaken for it.
 */
export const APP_PORT = 4331;
export const APP_ORIGIN = `http://localhost:${APP_PORT}`;

/**
 * The fake EmailJS and Turnstile (`fake-upstreams.ts`), on the loopback address the
 * Worker's seam URLs name (`EMAILJS_API_URL` and `TURNSTILE_VERIFY_URL` in `.dev.vars.e2e`).
 */
export const UPSTREAM_PORT = 4332;
export const UPSTREAM_ORIGIN = `http://127.0.0.1:${UPSTREAM_PORT}`;

/** The paths of the real providers' endpoints, kept so a seam URL reads like the real one. */
export const EMAILJS_PATH = '/emailjs/api/v1.0/email/send';
export const TURNSTILE_PATH = '/turnstile/v0/siteverify';
