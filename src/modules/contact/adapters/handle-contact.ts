// Pure: no `astro:*` or `cloudflare:*` import. The Action's handler reads `env` from
// `cloudflare:workers` (the one place that may) and passes what `createContactDeps` made of
// it here, so Vitest drives all of this with plain objects.
import {
  submitContact,
  type ContactContext,
  type ContactOutcome,
} from '../domain/submit-contact';
import type { ContactInput } from '../schema';
import type { CreateContactDepsResult } from './create-contact-deps';

// Fixed text, on purpose: only setting names are added to it, never a value (the settings
// are secrets, and `createContactDeps` reports names for that reason).
const NOT_CONFIGURED =
  'contact: the form is not configured, so the submission was answered unavailable';

/** The names as a list for a log line, or `none` when there are no names to list. */
function listed(names: readonly string[]): string {
  return names.length > 0 ? names.join(', ') : 'none';
}

/**
 * What the Action does with a submission that passed the schema: hand it to
 * `submitContact` when the Worker has what the form needs, and answer `unavailable` when
 * it has not. In that case no dependency exists to call (nothing is asked, nothing is
 * sent), and one fixed line names what is missing and what is invalid, so the owner can
 * see in the Worker's log why the form gives way to the notice. It never throws, like
 * `submitContact`, which matters here: Astro sends a handler's thrown message to the
 * browser.
 */
export async function handleContact(
  input: ContactInput,
  wiring: CreateContactDepsResult,
  context: ContactContext,
): Promise<ContactOutcome> {
  if (!wiring.ok) {
    console.error(
      `${NOT_CONFIGURED} (missing: ${listed(wiring.missing)}; invalid: ${listed(wiring.invalid)})`,
    );
    return { kind: 'unavailable' };
  }

  return submitContact(input, wiring.deps, context);
}
