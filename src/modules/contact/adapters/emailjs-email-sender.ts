// Pure: no `astro:*` or `cloudflare:*` import. The structural pieces below are all this
// needs from the outside, so Vitest drives it with a fake `fetch` and the composition
// root (`create-contact-deps.ts`) wires the Worker's own in.
import type { ContactConfig } from '../config';
import type { EmailSender } from '../ports';
import { ProviderFailure } from '../provider-failure';
import { globalFetch, postToProvider, type Fetch } from './outbound';

/**
 * EmailJS's REST endpoint for sending the email a template describes.
 * https://www.emailjs.com/docs/rest-api/send/
 */
const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

/**
 * The `EmailSender` that delivers through EmailJS, called from the Worker. EmailJS sends
 * the message through the owner's connected Gmail, from a template whose To Email is
 * fixed to the owner; the visitor's address only goes into Reply-To.
 *
 * It sends one request per message and only HTTP 200 counts as accepted: any other
 * status, a network error or the timeout rejects, so a failed delivery is never taken
 * for a sent one. It never retries (EmailJS allows 1 request a second and 200 a month on
 * the free plan), and it never reads the response body.
 *
 * Every error has fixed text, plus the HTTP status when there is one: Astro sends a thrown
 * error's message to the browser, so no key, no part of the visitor's message and nothing
 * the provider said can be in it. An answer other than 200 rejects with a
 * `ProviderFailure` that carries the status as its one detail; a network error or the
 * timeout is a plain `Error` with no detail.
 *
 * It logs nothing. The rejection reaches `submitContact`, which logs one fixed line for a
 * failed sender, with the status appended when there is one; a line here too would report
 * one failure twice.
 *
 * `config` is the EmailJS slice only, so the sender never sees the Turnstile secret.
 */
export function createEmailJsSender(
  config: ContactConfig['emailjs'],
  fetchImpl: Fetch = globalFetch,
): EmailSender {
  const url = config.apiUrl ?? EMAILJS_SEND_URL;

  return {
    async send(message) {
      const response = await postToProvider('EmailJS', fetchImpl, url, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: config.serviceId,
          template_id: config.templateId,
          // EmailJS names the account's public key `user_id`; the private key is its
          // `accessToken`, which the non-browser API requires.
          user_id: config.publicKey,
          accessToken: config.privateKey,
          // Each field is named, not spread: only these four ever leave the Worker.
          template_params: {
            from_name: message.name,
            reply_to: message.email,
            message: message.message,
            locale: message.locale,
          },
        }),
      });

      if (response.status !== 200) {
        throw new ProviderFailure(`EmailJS answered HTTP ${response.status}`, {
          status: response.status,
        });
      }
    },
  };
}
