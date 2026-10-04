// Pure domain rule: no `astro:*` or `cloudflare:*` import. `ContactInput` is a type-only
// import from the sibling schema (erased at compile time), used to describe the data
// shape; every provider arrives through a port in `deps`.
import type { EmailSender, RateLimiter, TurnstileVerifier } from '../ports';
import { failureSuffix } from '../provider-failure';
import type { ContactInput } from '../schema';
import { clientIp, rateLimitKey } from './rate-limit-key';

/** What `submitContact` needs from the outside world, all of it behind a port. */
export interface ContactDeps {
  readonly emailSender: EmailSender;
  readonly verifyTurnstile: TurnstileVerifier;
  readonly rateLimiter: RateLimiter;
}

/**
 * The part of the Action's context `submitContact` reads. Astro's `ActionAPIContext`
 * fits it, so the handler passes its own `context` straight through.
 */
export interface ContactContext {
  readonly request: { readonly headers: Pick<Headers, 'get'> };
}

/**
 * What became of a submission, for the Action to turn into a redirect or an error:
 *
 * - `sent`: delivered to the owner. A filled honeypot gets this too, silently.
 * - `rate_limited`: the client used up its budget.
 * - `verification_failed`: the Turnstile token was missing, rejected or unverifiable.
 * - `delivery_failed`: the email provider did not accept the message.
 *
 * It carries the kind and nothing else, so no visitor text, token or error can ride along.
 */
export type ContactOutcome =
  | { readonly kind: 'sent' }
  | { readonly kind: 'rate_limited' }
  | { readonly kind: 'verification_failed' }
  | { readonly kind: 'delivery_failed' };

// Fixed text, on purpose: a failing provider's error can quote the visitor's message, a
// token or a key, so what it says is never logged. A line names the step that failed. The
// verifier and sender lines may also end with the one closed suffix `failureSuffix` allows
// (the provider's HTTP status, for instance), and nothing else is read from an error.
const RATE_LIMITER_FAILED =
  'contact: the rate limiter failed, so the request was let through';
const VERIFIER_FAILED =
  'contact: the Turnstile verifier failed, so the submission was rejected';
const SENDER_FAILED = 'contact: the email sender failed';

/**
 * Fails open: a limiter that cannot answer must not take the contact form down with it,
 * and Turnstile still stands between the request and the inbox. Only an explicit `false`
 * denies.
 */
async function withinRateLimit(
  rateLimiter: RateLimiter,
  key: string,
): Promise<boolean> {
  try {
    return (await rateLimiter(key)) !== false;
  } catch {
    console.warn(RATE_LIMITER_FAILED);
    return true;
  }
}

/**
 * Fails closed: a verifier that cannot answer proves nothing, so the submission does not
 * go through. Only an explicit `true` verifies.
 */
async function isVerified(
  verify: TurnstileVerifier,
  token: string,
  remoteIp: string | undefined,
): Promise<boolean> {
  try {
    return (await verify(token, remoteIp)) === true;
  } catch (error) {
    console.error(VERIFIER_FAILED + failureSuffix(error));
    return false;
  }
}

/**
 * Handles one contact submission that already passed the schema, in this order: honeypot,
 * rate limit, Turnstile, send. It never throws: every outcome is a value, and a failing
 * dependency is turned into one (see `ContactOutcome`).
 *
 * - A filled honeypot ends it at once with a silent `sent` and no dependency is called,
 *   so a bot cannot tell it was caught (and spends nothing of the limiter or the quota).
 * - The rate limit comes before Turnstile so that a bot sending no token still spends its
 *   budget, and a flood never reaches Turnstile's API.
 * - A missing or blank token fails without asking Turnstile.
 */
export async function submitContact(
  input: ContactInput,
  deps: ContactDeps,
  context: ContactContext,
): Promise<ContactOutcome> {
  // Any content at all, whitespace included: people never see this input.
  if (input.website) {
    return { kind: 'sent' };
  }

  const { headers } = context.request;

  if (!(await withinRateLimit(deps.rateLimiter, rateLimitKey(headers)))) {
    return { kind: 'rate_limited' };
  }

  const token = input['cf-turnstile-response']?.trim();

  if (
    !token ||
    !(await isVerified(deps.verifyTurnstile, token, clientIp(headers)))
  ) {
    return { kind: 'verification_failed' };
  }

  try {
    await deps.emailSender.send({
      name: input.name,
      email: input.email,
      message: input.message,
      locale: input.locale,
    });
  } catch (error) {
    console.error(SENDER_FAILED + failureSuffix(error));
    return { kind: 'delivery_failed' };
  }

  return { kind: 'sent' };
}
