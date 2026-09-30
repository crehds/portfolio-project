import { describe, expect, it } from 'vitest';

import { LOCALES } from '../../shared/i18n/locales';
import {
  CONTACT_ERROR_CODES,
  CONTACT_LIMITS,
  contactSchema,
  isContactErrorCode,
} from './schema';

/** A submission as Astro delivers it once every required field has content. */
const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'I would like to talk about a project.',
  locale: 'en',
};

/**
 * What Astro exposes to the page as `ActionInputError.fields`: every issue message,
 * grouped by the first path segment. Astro runs the schema before the action handler and
 * rejects the submission with these, so they are all a visitor's browser ever sees.
 */
function fieldErrors(input: unknown): Record<string, string[]> {
  const result = contactSchema.safeParse(input);
  if (result.success) {
    throw new Error('Expected the schema to reject this submission.');
  }

  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    (fields[String(issue.path[0])] ??= []).push(issue.message);
  }
  return fields;
}

function parse(input: unknown) {
  const result = contactSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Expected the schema to accept this submission: ${JSON.stringify(fieldErrors(input))}`,
    );
  }
  return result.data;
}

function without(input: Record<string, unknown>, field: string) {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== field),
  );
}

describe('contactSchema: accepting a submission', () => {
  it('accepts a complete submission', () => {
    expect(parse(valid)).toEqual(valid);
  });

  it.each(LOCALES)('accepts the %s locale', (locale) => {
    expect(parse({ ...valid, locale }).locale).toBe(locale);
  });

  it('trims the name, the email and the message', () => {
    const data = parse({
      ...valid,
      name: '  Ada Lovelace \n',
      email: '\tada@example.com ',
      message: '\n Hello there \n',
    });

    expect(data.name).toBe('Ada Lovelace');
    expect(data.email).toBe('ada@example.com');
    expect(data.message).toBe('Hello there');
  });

  it('keeps the inner whitespace of the message, line breaks included', () => {
    expect(parse({ ...valid, message: 'one\n\ntwo  three' }).message).toBe(
      'one\n\ntwo  three',
    );
  });
});

describe('contactSchema: required fields', () => {
  const cases = ['name', 'email', 'message'].flatMap(
    (field): [string, string, string | null | undefined][] => [
      // Astro hands a required text field over as `null` when the visitor left it empty
      // (`handleFormDataGet`), so this is the case that really happens; the rest cover
      // whitespace, which Astro passes through, and crafted requests.
      [field, 'null', null],
      [field, 'undefined', undefined],
      [field, 'an empty string', ''],
      [field, 'only whitespace', ' \t\n '],
    ],
  );

  it.each(cases)(
    'reports %s as required when it is %s',
    (field, _label, value) => {
      expect(fieldErrors({ ...valid, [field]: value })).toEqual({
        [field]: ['required'],
      });
    },
  );

  it.each(['name', 'email', 'message'])(
    'reports %s as required when the key is absent',
    (field) => {
      expect(fieldErrors(without(valid, field))).toEqual({
        [field]: ['required'],
      });
    },
  );

  it('reports every empty field at once', () => {
    expect(
      fieldErrors({ name: null, email: null, message: null, locale: 'en' }),
    ).toEqual({
      name: ['required'],
      email: ['required'],
      message: ['required'],
    });
  });
});

describe('contactSchema: length limits', () => {
  // HTML `maxlength` counts UTF-16 code units, like `string.length`, so the page's limits
  // and this schema count the same thing.
  const EMAIL_DOMAIN = '@example.com';
  const emailOfLength = (length: number) =>
    'a'.repeat(length - EMAIL_DOMAIN.length) + EMAIL_DOMAIN;

  const cases: [string, (length: number) => string, number][] = [
    ['name', (length) => 'a'.repeat(length), 100],
    ['email', emailOfLength, 254],
    ['message', (length) => 'a'.repeat(length), 5000],
  ];

  it.each(cases)(
    'accepts a %s of exactly the limit',
    (field, ofLength, limit) => {
      expect(() => parse({ ...valid, [field]: ofLength(limit) })).not.toThrow();
    },
  );

  it.each(cases)(
    'rejects a %s one character past the limit',
    (field, ofLength, limit) => {
      expect(fieldErrors({ ...valid, [field]: ofLength(limit + 1) })).toEqual({
        [field]: ['too_long'],
      });
    },
  );

  it('exports the limits the page needs for its maxlength attributes', () => {
    expect(CONTACT_LIMITS).toEqual({ name: 100, email: 254, message: 5000 });
  });
});

// Zod runs checks in the order they are declared, so a trim declared after them would
// judge the padded text. These cases only pass when the trim comes first.
describe('contactSchema: trimming runs before the other checks', () => {
  it('accepts an email with spaces around it and returns it trimmed', () => {
    expect(parse({ ...valid, email: '  a@b.co  ' }).email).toBe('a@b.co');
  });

  it('does not count the spaces around a name toward its limit', () => {
    const data = parse({ ...valid, name: `  ${'a'.repeat(100)}  ` });

    expect(data.name).toBe('a'.repeat(100));
  });

  it('does not count the spaces around a message toward its limit', () => {
    const data = parse({ ...valid, message: `\n${'a'.repeat(5000)}\n` });

    expect(data.message).toHaveLength(5000);
  });

  it('does not count the spaces around an email toward its limit', () => {
    const email = `${'a'.repeat(242)}@example.com`;

    expect(parse({ ...valid, email: ` ${email} ` }).email).toBe(email);
  });

  it('still rejects a name that is too long once trimmed', () => {
    expect(fieldErrors({ ...valid, name: `  ${'a'.repeat(101)}  ` })).toEqual({
      name: ['too_long'],
    });
  });
});

describe('contactSchema: the email format', () => {
  it.each(['ada@example.com', 'first.last+tag@mail.example.co.uk', 'a@b.co'])(
    'accepts %s',
    (email) => {
      expect(parse({ ...valid, email }).email).toBe(email);
    },
  );

  it.each([
    'nope',
    'ada@',
    '@example.com',
    'a@b',
    'ada@@example.com',
    'ada lovelace@example.com',
    'ada@example..com',
    'ada@example.com, eve@example.com',
  ])('rejects %j as invalid_email', (email) => {
    expect(fieldErrors({ ...valid, email })).toEqual({
      email: ['invalid_email'],
    });
  });

  it('judges the length before the format, with one code per field', () => {
    expect(
      fieldErrors({ ...valid, email: 'not an email '.repeat(30) }),
    ).toEqual({ email: ['too_long'] });
  });
});

describe('contactSchema: the locale', () => {
  it.each([['fr'], ['EN'], [' es '], [''], [null], [undefined]])(
    'rejects %j as invalid',
    (locale) => {
      expect(fieldErrors({ ...valid, locale })).toEqual({
        locale: ['invalid'],
      });
    },
  );

  it('rejects an absent locale as invalid', () => {
    expect(fieldErrors(without(valid, 'locale'))).toEqual({
      locale: ['invalid'],
    });
  });
});

describe('contactSchema: the honeypot and the Turnstile token', () => {
  it('accepts a submission without either, as Astro delivers it when they are empty', () => {
    const data = parse({
      ...valid,
      website: undefined,
      'cf-turnstile-response': undefined,
    });

    expect(data.website).toBeUndefined();
    expect(data['cf-turnstile-response']).toBeUndefined();
  });

  it('accepts a submission that does not mention either', () => {
    expect(() => parse(valid)).not.toThrow();
  });

  it('accepts any honeypot content and leaves it as it came, for the domain to judge', () => {
    expect(
      parse({ ...valid, website: '  https://spam.example  ' }).website,
    ).toBe('  https://spam.example  ');
    expect(parse({ ...valid, website: '   ' }).website).toBe('   ');
  });

  it('passes the Turnstile token through untouched', () => {
    expect(
      parse({ ...valid, 'cf-turnstile-response': '0.aBc-123_xyz' })[
        'cf-turnstile-response'
      ],
    ).toBe('0.aBc-123_xyz');
  });

  it.each([['website'], ['cf-turnstile-response']])(
    'rejects a %s that is not text',
    (field) => {
      expect(fieldErrors({ ...valid, [field]: 7 })).toEqual({
        [field]: ['invalid'],
      });
      expect(fieldErrors({ ...valid, [field]: {} })).toEqual({
        [field]: ['invalid'],
      });
    },
  );
});

describe('contactSchema: stable error codes', () => {
  it('exports the four codes the localized dictionary must cover', () => {
    expect([...CONTACT_ERROR_CODES]).toEqual([
      'required',
      'invalid_email',
      'too_long',
      'invalid',
    ]);
  });

  it('never uses anything but a code as an issue message', () => {
    const errors = fieldErrors({
      name: 42,
      email: 'x'.repeat(300),
      message: null,
      website: 7,
      'cf-turnstile-response': {},
      locale: 'fr',
    });

    const messages = Object.values(errors).flat();

    expect(messages).toHaveLength(6);
    for (const message of messages) {
      expect(CONTACT_ERROR_CODES).toContain(message);
    }
  });

  it.each(CONTACT_ERROR_CODES)('recognizes %s as a code', (code) => {
    expect(isContactErrorCode(code)).toBe(true);
  });

  it.each([['Invalid input'], ['REQUIRED'], [''], [undefined], [null], [7]])(
    'does not recognize %j as a code',
    (value) => {
      expect(isContactErrorCode(value)).toBe(false);
    },
  );
});
