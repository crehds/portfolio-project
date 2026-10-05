import { describe, expect, it } from 'vitest';

import { LOCALES } from '../../shared/i18n/locales';
import { getDictionary } from '../../shared/i18n/ui';
import { fieldErrorMessage } from './field-error-message';
import { VISIBLE_FIELDS } from './page-state';
import { CONTACT_ERROR_CODES, CONTACT_LIMITS } from './schema';

describe('fieldErrorMessage', () => {
  it('says what to do in the visitor’s language, for the codes a field can really get', () => {
    const en = getDictionary('en');
    const es = getDictionary('es');

    expect(fieldErrorMessage('name', 'required', en)).toBe('Enter your name.');
    expect(fieldErrorMessage('name', 'required', es)).toBe(
      'Escribe tu nombre.',
    );
    expect(fieldErrorMessage('email', 'invalid_email', en)).toBe(
      'Enter a valid email address, like name@example.com.',
    );
    expect(fieldErrorMessage('email', 'invalid_email', es)).toBe(
      'Escribe un correo electrónico válido, como nombre@ejemplo.com.',
    );
    expect(fieldErrorMessage('message', 'required', en)).toBe(
      'Enter a message.',
    );
    expect(fieldErrorMessage('message', 'required', es)).toBe(
      'Escribe un mensaje.',
    );
  });

  it('puts each field’s own limit into a too-long message', () => {
    const en = getDictionary('en');

    expect(fieldErrorMessage('name', 'too_long', en)).toBe(
      `Your name must be ${CONTACT_LIMITS.name} characters or fewer.`,
    );
    expect(fieldErrorMessage('email', 'too_long', en)).toBe(
      `Your email address must be ${CONTACT_LIMITS.email} characters or fewer.`,
    );
    expect(fieldErrorMessage('message', 'too_long', en)).toBe(
      `Your message must be ${CONTACT_LIMITS.message} characters or fewer.`,
    );
  });

  it('puts the limit into the Spanish message too', () => {
    expect(fieldErrorMessage('message', 'too_long', getDictionary('es'))).toBe(
      `Tu mensaje debe tener ${CONTACT_LIMITS.message} caracteres o menos.`,
    );
  });

  it('explains that a name cannot hold control characters', () => {
    expect(fieldErrorMessage('name', 'invalid', getDictionary('en'))).toBe(
      'Your name cannot contain line breaks or other control characters.',
    );
  });

  it.each(LOCALES)(
    'has a sentence for every field and every code, with no placeholder left (%s)',
    (locale) => {
      const dictionary = getDictionary(locale);

      for (const field of VISIBLE_FIELDS) {
        for (const code of CONTACT_ERROR_CODES) {
          const message = fieldErrorMessage(field, code, dictionary);

          expect(message.trim(), `${field}/${code}`).not.toBe('');
          expect(message, `${field}/${code}`).not.toContain('{');
          expect(message, `${field}/${code}`).not.toContain('}');
        }
      }
    },
  );

  it.each(LOCALES)(
    'gives a different sentence for each code of a field, so the visitor is told what is wrong (%s)',
    (locale) => {
      const dictionary = getDictionary(locale);

      for (const field of VISIBLE_FIELDS) {
        const reachable =
          field === 'email'
            ? (['required', 'invalid_email', 'too_long'] as const)
            : (['required', 'too_long'] as const);
        const messages = reachable.map((code) =>
          fieldErrorMessage(field, code, dictionary),
        );

        expect(new Set(messages).size, field).toBe(messages.length);
      }
    },
  );

  it('falls back to a generic sentence for a code that does not fit the field', () => {
    const en = getDictionary('en');

    expect(fieldErrorMessage('message', 'invalid', en)).toBe(
      'This value cannot be used.',
    );
    expect(fieldErrorMessage('email', 'invalid', en)).toBe(
      'This value cannot be used.',
    );
    expect(fieldErrorMessage('name', 'invalid_email', en)).toBe(
      'This value cannot be used.',
    );
  });
});
