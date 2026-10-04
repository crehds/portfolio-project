// The contact module's ports: what the pure domain needs from the outside world. The
// adapters that fulfil them (EmailJS, Turnstile, Cloudflare's rate limiter) live apart and
// are wired in a composition root, so the domain never imports a provider, `fetch` or a
// Worker binding, and tests drive it with fakes.
import type { Locale } from '../../shared/i18n/locales';

/** A validated contact submission, ready to be delivered to the owner's inbox. */
export interface ContactMessage {
  /** The visitor's name, trimmed. It is text to show, not sanitized for a header line. */
  readonly name: string;
  /** The visitor's address, trimmed and valid: the owner's reply goes to it. */
  readonly email: string;
  readonly message: string;
  /** The language the visitor used the site in. */
  readonly locale: Locale;
}

/**
 * Delivers a message to the owner. Resolves once the provider accepted it and rejects when
 * it did not, so the caller never mistakes a failed delivery for a sent one. Today EmailJS
 * sends it through the owner's Gmail; Resend replaces the adapter once a domain exists.
 */
export interface EmailSender {
  send(message: ContactMessage): Promise<void>;
}

/**
 * Asks Turnstile whether `token` (the widget's answer for this submission) is genuine.
 * `remoteIp` is the visitor's IP when known, which Turnstile uses as an extra signal.
 * Resolves `false` when Turnstile rejects the token. Rejects when it could not be asked, or
 * could not judge the token: an answer that blames our secret, our request or Turnstile
 * itself (see `TURNSTILE_FAULT_CODES`) is the second kind, so a wrong secret key is a
 * failure the caller can log, not a visitor's rejected token.
 */
export type TurnstileVerifier = (
  token: string,
  remoteIp: string | undefined,
) => Promise<boolean>;

/**
 * Counts a request under `key` and resolves whether it is within the limit: `true` lets it
 * through, `false` means the key has used up its budget.
 */
export type RateLimiter = (key: string) => Promise<boolean>;
