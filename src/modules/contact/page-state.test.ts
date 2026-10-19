import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { LOCALES } from '../../shared/i18n/locales';
import { getDictionary } from '../../shared/i18n/ui';
import type { ContactOutcome } from './domain/submit-contact';
import { NO_VALUES, type ContactValues } from './form-values';
import {
  RETRY_AFTER_SECONDS,
  answerKeepsValues,
  contactPageState,
  contactTitle,
  sentLocation,
  type ContactAnswer,
  type ContactPageInput,
} from './page-state';

// What the contact page shows, and with which HTTP status, for every request it can get.
// The page itself is a thin root: it reads the Action's answer and the form values out of
// Astro, asks this function what to show, and applies the answer.

const VALUES: ContactValues = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hello <b>there</b>.\nSecond line.',
};

function input(overrides: Partial<ContactPageInput> = {}): ContactPageInput {
  return {
    configured: true,
    answer: undefined,
    sent: false,
    values: NO_VALUES,
    ...overrides,
  };
}

const outcome = (kind: ContactOutcome['kind']): ContactAnswer => ({
  kind: 'outcome',
  outcome: { kind },
});

const invalid = (fields: Record<string, string[]>): ContactAnswer => ({
  kind: 'invalid_input',
  fields,
});

describe('contactPageState: a GET', () => {
  it('shows the form, empty, with a 200 and no error in the title', () => {
    expect(contactPageState(input())).toEqual({
      kind: 'form',
      status: 200,
      errorTitle: false,
      values: NO_VALUES,
      fieldErrors: {},
    });
  });

  it('shows the success message for ?sent=1', () => {
    expect(contactPageState(input({ sent: true }))).toEqual({
      kind: 'sent',
      status: 200,
    });
  });

  it('shows the fallback notice, with a 200, when the Worker is not configured: the page itself is fine', () => {
    expect(contactPageState(input({ configured: false }))).toEqual({
      kind: 'fallback',
      status: 200,
      errorTitle: false,
      cause: 'not_configured',
      message: '',
    });
  });

  it('still shows the success message for ?sent=1 when the Worker is not configured', () => {
    expect(contactPageState(input({ configured: false, sent: true }))).toEqual({
      kind: 'sent',
      status: 200,
    });
  });
});

describe('contactPageState: a submission the Action took', () => {
  it('redirects to the success page when the message was sent', () => {
    expect(contactPageState(input({ answer: outcome('sent') }))).toEqual({
      kind: 'redirect_sent',
    });
  });

  it('redirects whatever else the request carried: the flag and the values change nothing', () => {
    expect(
      contactPageState(
        input({ answer: outcome('sent'), sent: true, values: VALUES }),
      ),
    ).toEqual({ kind: 'redirect_sent' });
  });

  it('answers 429 with the retry delay, and keeps what the visitor wrote, when the client is rate limited', () => {
    expect(
      contactPageState(
        input({ answer: outcome('rate_limited'), values: VALUES }),
      ),
    ).toEqual({
      kind: 'form',
      status: 429,
      retryAfter: RETRY_AFTER_SECONDS,
      errorTitle: true,
      values: VALUES,
      fieldErrors: {},
      alert: 'rate_limited',
    });
  });

  it('answers 400, asks to try again and keeps what the visitor wrote when the token did not verify', () => {
    expect(
      contactPageState(
        input({ answer: outcome('verification_failed'), values: VALUES }),
      ),
    ).toEqual({
      kind: 'form',
      status: 400,
      errorTitle: true,
      values: VALUES,
      fieldErrors: {},
      alert: 'verification_failed',
    });
  });

  it.each([
    ['delivery_failed', 502],
    ['unavailable', 503],
  ] as const)(
    'puts the fallback notice in the form’s place, with a %s status of %i and the message to copy',
    (kind, status) => {
      expect(
        contactPageState(input({ answer: outcome(kind), values: VALUES })),
      ).toEqual({
        kind: 'fallback',
        status,
        errorTitle: true,
        cause: kind,
        message: VALUES.message,
      });
    },
  );

  it('sets a retry delay for a rate limit and for nothing else', () => {
    const answers: ContactAnswer[] = [
      outcome('verification_failed'),
      outcome('delivery_failed'),
      outcome('unavailable'),
      invalid({ email: ['invalid_email'] }),
      { kind: 'too_large' },
      { kind: 'failed' },
    ];

    for (const answer of answers) {
      expect(contactPageState(input({ answer }))).not.toHaveProperty(
        'retryAfter',
      );
    }
    expect(
      contactPageState(input({ answer: outcome('rate_limited') })),
    ).toHaveProperty('retryAfter', RETRY_AFTER_SECONDS);
  });

  it('ignores the success flag when the Action answered: what happened to this submission wins', () => {
    expect(
      contactPageState(
        input({ answer: outcome('rate_limited'), sent: true, values: VALUES }),
      ),
    ).toMatchObject({ kind: 'form', status: 429 });
  });
});

describe('contactPageState: input the schema refused', () => {
  it('answers 400 with a code per field and keeps the values', () => {
    expect(
      contactPageState(
        input({
          answer: invalid({ email: ['invalid_email'], message: ['required'] }),
          values: VALUES,
        }),
      ),
    ).toEqual({
      kind: 'form',
      status: 400,
      errorTitle: true,
      values: VALUES,
      fieldErrors: { email: 'invalid_email', message: 'required' },
    });
  });

  it('takes the first code a field has', () => {
    expect(
      contactPageState(
        input({ answer: invalid({ name: ['required', 'too_long'] }) }),
      ),
    ).toMatchObject({ fieldErrors: { name: 'required' } });
  });

  it.each(['too_long', 'invalid', 'required', 'invalid_email'])(
    'carries the %s code through',
    (code) => {
      expect(
        contactPageState(input({ answer: invalid({ message: [code] }) })),
      ).toMatchObject({ fieldErrors: { message: code } });
    },
  );

  it('flags a field whose message is not a code the page knows as invalid, rather than dropping it', () => {
    expect(
      contactPageState(
        input({ answer: invalid({ name: ['Failed to validate'] }) }),
      ),
    ).toMatchObject({ fieldErrors: { name: 'invalid' } });
  });

  it('skips a field that lists no message', () => {
    expect(
      contactPageState(
        input({ answer: invalid({ name: [], email: ['required'] }) }),
      ),
    ).toMatchObject({ fieldErrors: { email: 'required' } });
  });

  it.each(['locale', 'website', 'cf-turnstile-response'])(
    'asks to try again, with no field to point at, when only the hidden field %s is refused',
    (field) => {
      const state = contactPageState(
        input({ answer: invalid({ [field]: ['invalid'] }), values: VALUES }),
      );

      expect(state).toEqual({
        kind: 'form',
        status: 400,
        errorTitle: true,
        values: VALUES,
        fieldErrors: {},
        alert: 'invalid_request',
      });
    },
  );

  it('asks to try again when the refusal names no field at all', () => {
    expect(contactPageState(input({ answer: invalid({}) }))).toMatchObject({
      status: 400,
      fieldErrors: {},
      alert: 'invalid_request',
    });
  });

  it('points at the visible fields alone when a hidden one is refused too', () => {
    const state = contactPageState(
      input({
        answer: invalid({ email: ['invalid_email'], locale: ['invalid'] }),
      }),
    );

    expect(state).toMatchObject({ fieldErrors: { email: 'invalid_email' } });
    expect(state).not.toHaveProperty('alert');
  });

  it('never lists a hidden field among the field errors', () => {
    const state = contactPageState(
      input({
        answer: invalid({
          locale: ['invalid'],
          website: ['invalid'],
          'cf-turnstile-response': ['invalid'],
          name: ['required'],
        }),
      }),
    );

    expect(state).toMatchObject({ fieldErrors: { name: 'required' } });
    if (state.kind !== 'form') {
      throw new Error('Expected the form.');
    }
    expect(Object.keys(state.fieldErrors)).toEqual(['name']);
  });
});

describe('contactPageState: a body that was too large', () => {
  it('answers 413 and asks for a shorter message, with nothing kept: the body was never read', () => {
    expect(contactPageState(input({ answer: { kind: 'too_large' } }))).toEqual({
      kind: 'form',
      status: 413,
      errorTitle: true,
      values: NO_VALUES,
      fieldErrors: {},
      alert: 'too_large',
    });
  });

  it('shows no values even if some were passed in', () => {
    expect(
      contactPageState(
        input({ answer: { kind: 'too_large' }, values: VALUES }),
      ),
    ).toMatchObject({ values: NO_VALUES });
  });
});

describe('contactPageState: any other failure of the Action', () => {
  it('shows the fallback notice with a 503 and the message to copy', () => {
    expect(
      contactPageState(input({ answer: { kind: 'failed' }, values: VALUES })),
    ).toEqual({
      kind: 'fallback',
      status: 503,
      errorTitle: true,
      cause: 'unavailable',
      message: VALUES.message,
    });
  });
});

describe('contactPageState: the Worker is not configured and a submission arrives', () => {
  const answers: [string, ContactAnswer][] = [
    ['unavailable', outcome('unavailable')],
    ['rate_limited', outcome('rate_limited')],
    ['verification_failed', outcome('verification_failed')],
    ['delivery_failed', outcome('delivery_failed')],
    ['invalid input', invalid({ email: ['invalid_email'] })],
    ['a body too large', { kind: 'too_large' }],
    ['another failure', { kind: 'failed' }],
  ];

  it.each(answers)(
    'shows the fallback notice with a 503 whatever the Action answered (%s)',
    (_label, answer) => {
      expect(
        contactPageState(input({ configured: false, answer, values: VALUES })),
      ).toEqual({
        kind: 'fallback',
        status: 503,
        errorTitle: true,
        cause: 'not_configured',
        message: VALUES.message,
      });
    },
  );
});

describe('answerKeepsValues', () => {
  it.each([
    ['no answer (a GET)', undefined, false],
    ['a sent message, which redirects', outcome('sent'), false],
    ['a body too large, which was never read', { kind: 'too_large' }, false],
    ['a rate limit', outcome('rate_limited'), true],
    ['a failed verification', outcome('verification_failed'), true],
    ['an unavailable verifier', outcome('unavailable'), true],
    ['a failed delivery', outcome('delivery_failed'), true],
    ['invalid input', invalid({ name: ['required'] }), true],
    ['another failure', { kind: 'failed' }, true],
  ] as const)(
    'says whether the values are worth reading for %s',
    (_label, answer, expected) => {
      expect(answerKeepsValues(answer)).toBe(expected);
    },
  );
});

describe('the retry delay', () => {
  it('is the period of the rate limit binding in wrangler.jsonc, so the page never promises a different wait', () => {
    const config = readFileSync(
      new URL('../../../wrangler.jsonc', import.meta.url),
      'utf8',
    );
    const periods = [...config.matchAll(/"period":\s*(\d+)/g)].map((match) =>
      Number(match[1]),
    );

    // The production binding and the previews mirror.
    expect(periods).toHaveLength(2);
    expect(periods).toEqual([RETRY_AFTER_SECONDS, RETRY_AFTER_SECONDS]);
  });
});

describe('sentLocation', () => {
  it('is the contact page of the locale, with the success flag', () => {
    expect(sentLocation('en')).toBe('/contact/?sent=1');
    expect(sentLocation('es')).toBe('/es/contact/?sent=1');
  });

  it('is one of exactly those two addresses, whatever the locale it is asked for', () => {
    // The locale is read from the page's own URL and narrowed to the supported ones, so a
    // visitor cannot steer the redirect anywhere else: there is no open redirect to find.
    for (const locale of LOCALES) {
      expect(sentLocation(locale)).toMatch(/^(\/es)?\/contact\/\?sent=1$/);
    }
  });
});

describe('contactTitle', () => {
  it('is the page title, in the visitor’s language', () => {
    expect(contactTitle(getDictionary('en'), false)).toBe(
      'Contact — Carlos Rodríguez Huerta',
    );
    expect(contactTitle(getDictionary('es'), false)).toBe(
      'Contacto — Carlos Rodríguez Huerta',
    );
  });

  it('starts with the error word when the page answers a submission that did not go through, so a screen reader announces it first', () => {
    expect(contactTitle(getDictionary('en'), true)).toBe(
      'Error: Contact — Carlos Rodríguez Huerta',
    );
    expect(contactTitle(getDictionary('es'), true)).toBe(
      'Error: Contacto — Carlos Rodríguez Huerta',
    );
  });
});
