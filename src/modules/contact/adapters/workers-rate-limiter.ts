// Pure: no `cloudflare:*` import. The structural type below is all this needs from the
// Workers runtime, so Vitest drives it with a fake binding and the composition root
// (`create-contact-deps.ts`) wires the real one in.
import type { RateLimiter } from '../ports';

/**
 * What the limiter needs from a Workers Rate Limiting binding; the `RateLimit` type that
 * `wrangler types` generates fits it. `limit` resolves `{ success: false }` once the key
 * has used up its budget.
 * https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

// Fixed text, on purpose: see `createWorkersRateLimiter`.
const BINDING_FAILED = 'The rate limit binding failed';
const BINDING_ANSWERED_UNEXPECTEDLY =
  'The rate limit binding answered with an unexpected result';

/**
 * The `RateLimiter` backed by a Workers Rate Limiting binding. It counts the request under
 * `key` and resolves the binding's own `success`: `true` within the limit, `false` once
 * the key used up its budget. The counter is per Cloudflare location and eventually
 * consistent, a soft layer in front of Turnstile rather than exact accounting.
 *
 * A binding that cannot answer, by rejecting, throwing or returning anything but
 * `{ success: boolean }`, makes the limiter reject with fixed text and no `cause`: neither
 * `true` nor `false` would be the binding's answer. The policy for that lives in
 * `submitContact`, which lets the request through (fail open), because a limiter that
 * cannot answer must not take the contact form down with it, and logs one fixed line.
 * That is the only log line: this adapter logs nothing, so the failure is reported once.
 */
export function createWorkersRateLimiter(
  binding: RateLimitBinding,
): RateLimiter {
  return async (key) => {
    let outcome: unknown;
    try {
      // On the binding itself, so a runtime method that needs its receiver keeps it.
      outcome = await binding.limit({ key });
    } catch {
      throw new Error(BINDING_FAILED);
    }

    const success = (outcome as { success?: unknown } | null | undefined)
      ?.success;
    if (typeof success !== 'boolean') {
      throw new Error(BINDING_ANSWERED_UNEXPECTEDLY);
    }

    return success;
  };
}
