import { defineMiddleware } from 'astro:middleware';

import { applySecurityHeaders } from './shared/security/apply-headers';

// Puts the security headers on every response the Worker generates: the contact pages, the
// Action's answer and `/cv/<locale>.pdf`. Prerendered pages and assets get theirs from
// `public/_headers`, which Workers static assets apply to the responses they serve
// themselves and never to these. Both read `src/shared/security/headers.ts`.
export const onRequest = defineMiddleware(async (context, next) =>
  applySecurityHeaders(context.url.pathname, await next()),
);
