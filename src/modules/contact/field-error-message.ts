// Pure: no `astro:*` import. The page translates the stable codes the schema reports
// (`ContactErrorCode`) into a sentence in the visitor's language.
import type { UiDictionary } from '../../shared/i18n/ui';
import type { VisibleField } from './page-state';
import { CONTACT_LIMITS, type ContactErrorCode } from './schema';

/** What goes in a field's `{limit}` place: the number the schema enforces for it. */
const LIMIT_PLACEHOLDER = '{limit}';

const GENERIC = 'contactErrorInvalidValue' satisfies keyof UiDictionary;

/**
 * Which sentence says what, per field and code. The schema gives a field only some of the
 * codes (an `invalid_email` can only be the email's, and a name is the only field that can
 * be `invalid` for a reason a person can fix), so the pairs a visitor can really reach have
 * a sentence of their own and every other pair falls back to the generic one.
 */
const MESSAGES: Record<
  VisibleField,
  Record<ContactErrorCode, keyof UiDictionary>
> = {
  name: {
    required: 'contactErrorNameRequired',
    too_long: 'contactErrorNameTooLong',
    invalid: 'contactErrorNameInvalid',
    invalid_email: GENERIC,
  },
  email: {
    required: 'contactErrorEmailRequired',
    invalid_email: 'contactErrorEmailInvalid',
    too_long: 'contactErrorEmailTooLong',
    invalid: GENERIC,
  },
  message: {
    required: 'contactErrorMessageRequired',
    too_long: 'contactErrorMessageTooLong',
    invalid: GENERIC,
    invalid_email: GENERIC,
  },
};

/**
 * The sentence for an error of `field`, from the page's dictionary, with the field's own
 * limit written into it where the sentence says `{limit}`.
 */
export function fieldErrorMessage(
  field: VisibleField,
  code: ContactErrorCode,
  dictionary: UiDictionary,
): string {
  return dictionary[MESSAGES[field][code]].replaceAll(
    LIMIT_PLACEHOLDER,
    String(CONTACT_LIMITS[field]),
  );
}
