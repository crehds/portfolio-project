// Pure: no `astro:*` import. It needs only `get`, so Vitest drives it with a real
// `FormData` and the page passes the one it re-reads from the request.

/**
 * What the visitor typed into the three visible fields, exactly as typed (no trim): the
 * page puts it back into the form when a submission did not go through, so nobody has to
 * write a message twice.
 */
export interface ContactValues {
  readonly name: string;
  readonly email: string;
  readonly message: string;
}

/** The form as it first opens: nothing typed yet. */
export const NO_VALUES: ContactValues = { name: '', email: '', message: '' };

/** Text, or nothing: a file in a text field is not something the form can hold. */
function textOf(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Reads the three visible fields out of a submitted form. A field that is missing or is
 * not text is empty. The Turnstile token, the honeypot and the locale are not read: none
 * of them goes back into the page.
 */
export function readFormValues(form: Pick<FormData, 'get'>): ContactValues {
  return {
    name: textOf(form.get('name')),
    email: textOf(form.get('email')),
    message: textOf(form.get('message')),
  };
}
