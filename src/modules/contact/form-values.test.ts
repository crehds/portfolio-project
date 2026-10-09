import { describe, expect, it } from 'vitest';

import { NO_VALUES, readFormValues } from './form-values';

function formWith(entries: Record<string, string | Blob>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    form.append(name, value);
  }
  return form;
}

describe('NO_VALUES', () => {
  it('is an empty name, email and message', () => {
    expect(NO_VALUES).toEqual({ name: '', email: '', message: '' });
  });
});

describe('readFormValues', () => {
  it('reads the three text fields exactly as they were typed, spaces and line breaks included', () => {
    const values = readFormValues(
      formWith({
        name: '  Ada Lovelace ',
        email: ' ada@example.com',
        message: 'First line\r\n\r\n  second line  ',
      }),
    );

    expect(values).toEqual({
      name: '  Ada Lovelace ',
      email: ' ada@example.com',
      message: 'First line\r\n\r\n  second line  ',
    });
  });

  it('gives an empty string for a field that was not sent', () => {
    expect(readFormValues(formWith({ name: 'Ada' }))).toEqual({
      name: 'Ada',
      email: '',
      message: '',
    });
  });

  it('gives an empty string for a field that is a file, not text', () => {
    const values = readFormValues(
      formWith({
        name: new Blob(['not text'], { type: 'text/plain' }),
        email: 'ada@example.com',
      }),
    );

    expect(values.name).toBe('');
    expect(values.email).toBe('ada@example.com');
  });

  it('reads nothing but the three fields: the token, the honeypot and the locale stay out', () => {
    const values = readFormValues(
      formWith({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hi',
        website: 'https://spam.example',
        'cf-turnstile-response': 'a-token',
        locale: 'en',
      }),
    );

    expect(Object.keys(values).sort()).toEqual(['email', 'message', 'name']);
  });

  it('keeps the first value of a field that was sent twice, like FormData.get does', () => {
    const form = new FormData();
    form.append('name', 'first');
    form.append('name', 'second');

    expect(readFormValues(form).name).toBe('first');
  });

  it('does not change what it reads: an empty form gives the empty values', () => {
    expect(readFormValues(new FormData())).toEqual(NO_VALUES);
  });
});
