// Pure domain rule: no `astro:*` or `cloudflare:*` import. It needs only `Headers.get`,
// so Vitest drives it with a real `Headers` (or a stand-in) and the Action passes the
// request's own.

/** The key every request without a known client IP shares (local dev and preview). */
export const UNKNOWN_CLIENT_KEY = 'unknown';

/**
 * The client's IP as Cloudflare reports it, or `undefined` when the request carries none.
 *
 * Only `cf-connecting-ip` counts: Cloudflare sets it to the IP address of the client
 * connecting to it, always exactly one address. `X-Forwarded-For`, `X-Real-IP` and the
 * like carry whatever the client wrote (Cloudflare only appends to an existing
 * `X-Forwarded-For`), so they are never read: trusting one would let a bot pick a fresh
 * rate-limit key per request.
 */
export function clientIp(headers: Pick<Headers, 'get'>): string | undefined {
  const ip = headers.get('cf-connecting-ip')?.trim();

  return ip ? ip : undefined;
}

/**
 * What the rate limiter counts requests under: the client IP, or the one shared
 * `unknown` key when there is none (so anonymous traffic is limited together, never
 * exempt).
 */
export function rateLimitKey(headers: Pick<Headers, 'get'>): string {
  return clientIp(headers) ?? UNKNOWN_CLIENT_KEY;
}
