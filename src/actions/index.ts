// Thin composition root for the contact form's Action: it reads the Worker's `env` and
// hands everything else to `handleContact`, which owns what happens next (the wiring
// check, the answer for a Worker that is not configured, `submitContact`).
//
// Astro validates the form against `contactSchema` BEFORE the handler runs and answers
// invalid input itself (`ActionInputError`), so the handler only ever sees a parsed
// `ContactInput`. It must never throw: Astro sends the message of anything that is not an
// `ActionError` to the browser. `handleContact` never throws, `createContactDeps` never
// throws, and the handler adds nothing that could.
//
// Two doors lead here, with the same checks on both: the contact pages post the form to
// themselves (`?_action=contact`), and Astro also exposes every Action at
// `/_actions/contact`. Both run Astro's origin check (a cross-site form post is refused
// with a 403), the body size limit (`security.actionBodySizeLimit`), the schema and this
// handler, so the honeypot, the rate limit and Turnstile apply to either.
import { defineAction } from 'astro:actions';
// Bindings and settings come from `cloudflare:workers`: `Astro.locals.runtime.env` was
// removed in the Cloudflare adapter v13 and throws. The `Env` type is generated from
// wrangler.jsonc by `wrangler types` (`pnpm check` runs it first).
import { env } from 'cloudflare:workers';

import { createContactDeps } from '../modules/contact/adapters/create-contact-deps';
import { handleContact } from '../modules/contact/adapters/handle-contact';
import { contactSchema } from '../modules/contact/schema';

export const server = {
  contact: defineAction({
    accept: 'form',
    input: contactSchema,
    handler: (input, context) =>
      handleContact(input, createContactDeps(env), context),
  }),
};
