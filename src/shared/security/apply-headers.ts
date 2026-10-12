import { policyKindFor, securityHeaders } from './headers';

/**
 * The same response with the security headers of its route added. A new `Response` is built
 * from the old one's status, body and headers, because the headers of a redirect or of a
 * fetched answer are immutable. A header the response already had is replaced only when it
 * is one of the security headers; every other one, `Cache-Control` and `Set-Cookie`
 * included, is kept as it was.
 */
export function applySecurityHeaders(
  pathname: string,
  response: Response,
): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of securityHeaders(policyKindFor(pathname))) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
