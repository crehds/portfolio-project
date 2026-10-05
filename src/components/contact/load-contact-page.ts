// What the two contact pages (`src/pages/contact/index.astro` and
// `src/pages/es/contact/index.astro`) share, so that they stay thin roots: read the Action's
// answer, the form values and the Worker's settings out of Astro, ask `contactPageState`
// what to show, and apply the answer (the HTTP status, `Retry-After`, the redirect). All
// the rules live in `src/modules/contact` and are tested there; this is the glue, covered
// by the end-to-end tests.
//
// `env` is a parameter: `cloudflare:workers` is imported by the pages and the Action only,
// the places that compose the Worker.
import type { AstroGlobal } from 'astro';
import { actions, isInputError, type ActionReturnType } from 'astro:actions';
import { getEntry } from 'astro:content';

import { createContactDeps } from '../../modules/contact/adapters/create-contact-deps';
import {
  NO_VALUES,
  readFormValues,
  type ContactValues,
} from '../../modules/contact/form-values';
import {
  answerKeepsValues,
  contactPageState,
  contactTitle,
  sentLocation,
  type ContactAnswer,
  type ContactPageState,
} from '../../modules/contact/page-state';
import {
  directContactLinks,
  type DirectContactLink,
} from '../../modules/profile/domain/direct-contact-links';
import { localeOfPathname } from '../../shared/i18n/paths';
import { getDictionary } from '../../shared/i18n/ui';

/** The part of Astro's global the loader reads and writes. */
type ContactAstro = Pick<
  AstroGlobal,
  'request' | 'url' | 'response' | 'redirect' | 'getActionResult'
>;

/** What a contact page renders, or the redirect it answers instead. */
export type LoadedContactPage =
  | { readonly redirect: Response }
  | {
      readonly title: string;
      readonly description: string;
      readonly state: Exclude<ContactPageState, { kind: 'redirect_sent' }>;
      /** Turnstile's public site key; there whenever the Worker is configured. */
      readonly siteKey: string | undefined;
      readonly links: readonly DirectContactLink[];
    };

type ContactActionResult = ActionReturnType<typeof actions.contact> | undefined;

/** Astro's action result as the plain data `contactPageState` decides from. */
function answerOf(result: ContactActionResult): ContactAnswer | undefined {
  if (!result) {
    return undefined;
  }

  if (result.error) {
    if (isInputError(result.error)) {
      return {
        kind: 'invalid_input',
        fields: Object.fromEntries(
          Object.entries(result.error.fields).map(([field, messages]) => [
            field,
            messages ?? [],
          ]),
        ),
      };
    }

    return result.error.code === 'CONTENT_TOO_LARGE'
      ? { kind: 'too_large' }
      : { kind: 'failed' };
  }

  return { kind: 'outcome', outcome: result.data };
}

/**
 * What the visitor typed, read again from the request. The Action read the same body
 * through a clone (Astro leaves the request's own body unread), and it enforced the size
 * limit first, so this only ever reads a body the Action accepted: `answerKeepsValues` is
 * false for one it refused as too large. A body that cannot be read gives no values.
 */
async function valuesOf(request: Request): Promise<ContactValues> {
  try {
    return readFormValues(await request.clone().formData());
  } catch {
    return NO_VALUES;
  }
}

export async function loadContactPage(
  astro: ContactAstro,
  env: unknown,
): Promise<LoadedContactPage> {
  const locale = localeOfPathname(astro.url.pathname);
  const dictionary = getDictionary(locale);

  const wiring = createContactDeps(env);
  const answer = answerOf(astro.getActionResult(actions.contact));
  const values = answerKeepsValues(answer)
    ? await valuesOf(astro.request)
    : NO_VALUES;

  const state = contactPageState({
    configured: wiring.ok,
    answer,
    sent: astro.url.searchParams.get('sent') === '1',
    values,
  });

  if (state.kind === 'redirect_sent') {
    return { redirect: astro.redirect(sentLocation(locale), 303) };
  }

  astro.response.status = state.status;
  if (state.kind === 'form' && state.retryAfter !== undefined) {
    astro.response.headers.set('Retry-After', String(state.retryAfter));
  }

  const profile = await getEntry('profile', 'profile');
  if (!profile) {
    throw new Error(
      'The "profile" content entry is missing; the contact page needs it for the email and WhatsApp links.',
    );
  }

  return {
    title: contactTitle(dictionary, state.kind !== 'sent' && state.errorTitle),
    description: dictionary.contactPageDescription,
    state,
    siteKey: wiring.ok ? wiring.siteKey : undefined,
    links: directContactLinks(profile.data),
  };
}
