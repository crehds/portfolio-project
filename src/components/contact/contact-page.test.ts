import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import {
  NO_VALUES,
  type ContactValues,
} from '../../modules/contact/form-values';
import type { ContactPageState } from '../../modules/contact/page-state';
import { CONTACT_LIMITS } from '../../modules/contact/schema';
import { directContactLinks } from '../../modules/profile/domain/direct-contact-links';
import { LOCALES, type Locale } from '../../shared/i18n/locales';
import { pathnameInLocale } from '../../shared/i18n/paths';
import { getDictionary } from '../../shared/i18n/ui';
import ContactPage from './ContactPage.astro';

// The contact page's content for each state `contactPageState` can ask for, rendered by
// Astro's container and read back as HTML. The pages are thin roots (see
// `src/pages/contact/index.astro`); what they pass in is exactly the view model here.

type Shown = Exclude<ContactPageState, { kind: 'redirect_sent' }>;

const SITE_KEY = 'site-key-for-the-test';
const LINKS = directContactLinks({
  whatsapp: '+51970791041',
  email: 'carlos15erh@gmail.com',
});

async function render(
  state: Shown,
  locale: Locale,
  siteKey: string | undefined = SITE_KEY,
): Promise<string> {
  const container = await AstroContainer.create();

  return container.renderToString(ContactPage, {
    request: new Request(
      `http://localhost${pathnameInLocale('/contact/', locale)}`,
    ),
    props: { state, siteKey, links: LINKS },
  });
}

function form(
  overrides: Partial<Extract<Shown, { kind: 'form' }>> = {},
): Shown {
  return {
    kind: 'form',
    status: 200,
    errorTitle: false,
    values: NO_VALUES,
    fieldErrors: {},
    ...overrides,
  };
}

function decode(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

// A tag's attributes up to its closing `>`, the way a browser reads them: a `>` inside a
// quoted value does not end the tag (Astro escapes the quote in an attribute value and
// leaves `<` and `>` as they are, which is safe because the quote is what closes it).
const ATTRIBUTES = `(?:[^>"]|"[^"]*")*`;

/** The opening tag of the element with this id; fails the test if there is none. */
function openingTag(html: string, id: string): string {
  const match = html.match(
    new RegExp(`<[a-z0-9]+\\b${ATTRIBUTES}?\\bid="${id}"${ATTRIBUTES}>`),
  );
  if (!match) {
    throw new Error(`No element with id "${id}" in the page.`);
  }
  return match[0];
}

/** The page with every quoted attribute value emptied: what is left is its markup and text. */
function withoutAttributeValues(html: string): string {
  return html.replace(/="[^"]*"/g, '=""');
}

/** The raw (still escaped) value of an attribute of an opening tag. */
function attributeOf(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

function hasId(html: string, id: string): boolean {
  return new RegExp(`\\bid="${id}"`).test(html);
}

/** The text of the element with this id: tags removed, spaces collapsed, entities decoded. */
function textOf(html: string, id: string): string {
  const open = openingTag(html, id);
  const name = /^<([a-z0-9]+)/.exec(open)?.[1] ?? '';
  const start = html.indexOf(open) + open.length;
  const end = html.indexOf(`</${name}>`, start);

  return decode(
    html
      .slice(start, end)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

describe.each(LOCALES)('the contact form (%s)', (locale) => {
  const dictionary = getDictionary(locale);

  it('has the page heading and the lead', async () => {
    const html = await render(form(), locale);

    expect(html).toMatch(
      new RegExp(`<h1[^>]*>\\s*${dictionary.contactPageHeading}\\s*</h1>`),
    );
    expect(decode(html)).toContain(dictionary.contactLead);
  });

  it('posts to the Action through the page itself, and leaves validation to the server', async () => {
    const html = await render(form(), locale);

    const formTag = html.match(/<form\b[^>]*>/)?.[0] ?? '';
    expect(formTag).toContain('method="POST"');
    expect(formTag).toContain('action="?_action=contact"');
    expect(formTag).toContain('novalidate');
  });

  it('carries the locale the page was served in, for the schema', async () => {
    const html = await render(form(), locale);

    expect(html).toMatch(
      new RegExp(
        `<input[^>]*type="hidden"[^>]*name="locale"[^>]*value="${locale}"|<input[^>]*name="locale"[^>]*type="hidden"[^>]*value="${locale}"|<input[^>]*value="${locale}"[^>]*type="hidden"[^>]*name="locale"`,
      ),
    );
  });

  it('labels the name field and asks the browser to suggest the visitor’s name', async () => {
    const html = await render(form(), locale);

    expect(html).toMatch(/<label[^>]*for="contact-name"/);
    expect(textOf(html, 'contact-name-label')).toBe(
      dictionary.contactFormNameLabel,
    );
    const input = openingTag(html, 'contact-name');
    expect(input).toContain('name="name"');
    expect(input).toContain('type="text"');
    expect(input).toContain('autocomplete="name"');
    expect(input).toContain('required');
    expect(input).toContain(`maxlength="${CONTACT_LIMITS.name}"`);
  });

  it('labels the email field and asks the browser to suggest the visitor’s address', async () => {
    const html = await render(form(), locale);

    expect(textOf(html, 'contact-email-label')).toBe(
      dictionary.contactFormEmailLabel,
    );
    const input = openingTag(html, 'contact-email');
    expect(input).toContain('name="email"');
    expect(input).toContain('type="email"');
    expect(input).toContain('autocomplete="email"');
    expect(input).toContain('required');
    expect(input).toContain(`maxlength="${CONTACT_LIMITS.email}"`);
  });

  it('labels the message field, a text area with the same limit as the schema', async () => {
    const html = await render(form(), locale);

    expect(textOf(html, 'contact-message-label')).toBe(
      dictionary.contactFormMessageLabel,
    );
    const area = openingTag(html, 'contact-message');
    expect(area).toMatch(/^<textarea/);
    expect(area).toContain('name="message"');
    expect(area).toContain('required');
    expect(area).toContain(`maxlength="${CONTACT_LIMITS.message}"`);
  });

  it('has a submit button in the visitor’s language', async () => {
    const html = await render(form(), locale);

    expect(html).toMatch(
      new RegExp(
        `<button[^>]*type="submit"[^>]*>\\s*${dictionary.contactFormSubmit}\\s*</button>`,
      ),
    );
  });

  it('asks Turnstile for a flexible widget in the page language, with the site key it was given', async () => {
    const html = await render(form(), locale);

    const widget = html.match(
      /<div\b[^>]*class="[^"]*cf-turnstile[^"]*"[^>]*>/,
    );
    expect(widget?.[0]).toContain(`data-sitekey="${SITE_KEY}"`);
    expect(widget?.[0]).toContain(`data-language="${locale}"`);
    expect(widget?.[0]).toContain('data-size="flexible"');
  });

  it('loads Turnstile’s script once, async and deferred, from Cloudflare', async () => {
    const html = await render(form(), locale);

    const scripts = [
      ...html.matchAll(
        /<script\b[^>]*src="https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js"[^>]*>/g,
      ),
    ];
    expect(scripts).toHaveLength(1);
    expect(scripts[0][0]).toMatch(/\basync\b/);
    expect(scripts[0][0]).toMatch(/\bdefer\b/);
  });

  it('opens with no error summary and no alert', async () => {
    const html = await render(form(), locale);

    expect(html).not.toContain('role="alert"');
    expect(hasId(html, 'contact-error-summary')).toBe(false);
    for (const field of ['name', 'email', 'message']) {
      expect(openingTag(html, `contact-${field}`)).not.toContain(
        'aria-invalid',
      );
    }
  });

  it('lists email and WhatsApp as the other ways to write', async () => {
    const html = await render(form(), locale);

    expect(textOf(html, 'contact-other-ways')).toBe(
      dictionary.contactOtherWaysHeading,
    );
    expect(html).toContain('href="mailto:carlos15erh@gmail.com"');
    expect(html).toContain('href="https://wa.me/51970791041"');
  });
});

describe.each(LOCALES)('a form that was refused (%s)', (locale) => {
  const dictionary = getDictionary(locale);
  const state = form({
    status: 400,
    errorTitle: true,
    values: { name: '', email: 'not-an-email', message: '' },
    fieldErrors: {
      name: 'required',
      email: 'invalid_email',
      message: 'required',
    },
  });

  it('opens with an alert that names the problem and links to every field with an error', async () => {
    const html = await render(state, locale);

    expect(openingTag(html, 'contact-error-summary')).toContain('role="alert"');
    expect(textOf(html, 'contact-error-summary-heading')).toBe(
      dictionary.contactErrorSummaryHeading,
    );
    for (const field of ['name', 'email', 'message']) {
      expect(html).toContain(`href="#contact-${field}"`);
    }
  });

  it('says in the summary what each error is, with the word Error in front', async () => {
    const html = await render(state, locale);
    const summary = textOf(html, 'contact-error-summary');

    expect(summary).toContain(
      `${dictionary.contactErrorPrefix} ${dictionary.contactErrorNameRequired}`,
    );
    expect(summary).toContain(
      `${dictionary.contactErrorPrefix} ${dictionary.contactErrorEmailInvalid}`,
    );
    expect(summary).toContain(
      `${dictionary.contactErrorPrefix} ${dictionary.contactErrorMessageRequired}`,
    );
  });

  it('writes each error under its field, with the word Error visible: colour alone says nothing', async () => {
    const html = await render(state, locale);

    expect(textOf(html, 'contact-name-error')).toBe(
      `${dictionary.contactErrorPrefix} ${dictionary.contactErrorNameRequired}`,
    );
    expect(textOf(html, 'contact-email-error')).toBe(
      `${dictionary.contactErrorPrefix} ${dictionary.contactErrorEmailInvalid}`,
    );
    expect(textOf(html, 'contact-message-error')).toBe(
      `${dictionary.contactErrorPrefix} ${dictionary.contactErrorMessageRequired}`,
    );
  });

  it('marks each invalid field and ties it to its own error', async () => {
    const html = await render(state, locale);

    for (const field of ['name', 'email', 'message']) {
      const tag = openingTag(html, `contact-${field}`);
      expect(tag).toContain('aria-invalid="true"');
      expect(tag).toContain(`aria-describedby="contact-${field}-error"`);
    }
  });

  it('marks only the fields that have an error', async () => {
    const html = await render(
      form({
        status: 400,
        errorTitle: true,
        fieldErrors: { email: 'invalid_email' },
      }),
      locale,
    );

    expect(openingTag(html, 'contact-email')).toContain('aria-invalid="true"');
    for (const field of ['name', 'message']) {
      const tag = openingTag(html, `contact-${field}`);
      expect(tag).not.toContain('aria-invalid');
      expect(tag).not.toContain('aria-describedby');
      expect(hasId(html, `contact-${field}-error`)).toBe(false);
      expect(html).not.toContain(`href="#contact-${field}"`);
    }
  });

  it('writes the limit into a too-long error', async () => {
    const html = await render(
      form({ status: 400, fieldErrors: { message: 'too_long' } }),
      locale,
    );

    expect(textOf(html, 'contact-message-error')).toContain(
      String(CONTACT_LIMITS.message),
    );
  });

  it('puts back what the visitor typed', async () => {
    const values: ContactValues = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'First line\nSecond line',
    };
    const html = await render(
      form({ status: 400, values, fieldErrors: { name: 'too_long' } }),
      locale,
    );

    expect(openingTag(html, 'contact-name')).toContain('value="Ada Lovelace"');
    expect(openingTag(html, 'contact-email')).toContain(
      'value="ada@example.com"',
    );
    expect(textOf(html, 'contact-message')).toBe('First line Second line');
    expect(html).toContain('First line\nSecond line');
  });

  it('puts the message in the text area with nothing around it, so no space becomes part of the message', async () => {
    const html = await render(
      form({
        status: 400,
        values: { ...NO_VALUES, message: 'First line\nSecond line' },
        fieldErrors: { name: 'required' },
      }),
      locale,
    );

    const inner = new RegExp(
      `<textarea\\b${ATTRIBUTES}>([\\s\\S]*?)</textarea>`,
    ).exec(html)?.[1];
    expect(inner).toBe('First line\nSecond line');
  });

  it('shows the form with the same fields and widget as the first time', async () => {
    const html = await render(state, locale);

    expect(html).toContain('name="locale"');
    expect(html).toContain(`data-sitekey="${SITE_KEY}"`);
    expect(html).toContain('type="submit"');
  });
});

describe.each(LOCALES)(
  'what the visitor typed is only ever text (%s)',
  (locale) => {
    const hostile: ContactValues = {
      name: '"><img src=x onerror=alert(1)>',
      email: '<script>alert(1)</script>',
      message: '</textarea><script>alert(2)</script><b>bold</b>',
    };

    const refused = (values: ContactValues) =>
      form({
        status: 400,
        errorTitle: true,
        values,
        fieldErrors: { email: 'invalid_email' },
      });

    it('keeps a quote in an attribute value from closing it, so it cannot add an attribute or an element', async () => {
      const html = await render(refused(hostile), locale);

      // Astro writes `"` as `&quot;` and leaves `<` and `>` alone, which a browser reads as
      // part of the quoted value: the value runs on to the closing quote, which is ours.
      expect(attributeOf(openingTag(html, 'contact-name'), 'value')).toBe(
        '&quot;><img src=x onerror=alert(1)>',
      );
      expect(attributeOf(openingTag(html, 'contact-email'), 'value')).toBe(
        '<script>alert(1)</script>',
      );
    });

    it('adds no element of its own anywhere in the page', async () => {
      const html = await render(refused(hostile), locale);

      // With every attribute value emptied, only markup and text remain: nothing the visitor
      // typed may be among it as a tag.
      const markup = withoutAttributeValues(html);
      expect(markup).not.toContain('<img');
      expect(markup).not.toContain('<b>');
      expect(markup).not.toMatch(/<script>\s*alert/);
      expect(markup).not.toContain('</textarea><script>');
      // The only scripts are the page's own: Turnstile's two (the theme, then the api).
      expect([...markup.matchAll(/<script\b/g)]).toHaveLength(2);
    });

    it('escapes it as text where it is text, in the message text area', async () => {
      const html = await render(refused(hostile), locale);

      expect(html).toContain(
        '&lt;/textarea&gt;&lt;script&gt;alert(2)&lt;/script&gt;&lt;b&gt;bold&lt;/b&gt;',
      );
    });

    it('is read back as the exact text that was typed', async () => {
      const html = await render(refused(hostile), locale);

      expect(
        decode(attributeOf(openingTag(html, 'contact-name'), 'value') ?? ''),
      ).toBe(hostile.name);
      expect(textOf(html, 'contact-message')).toBe(hostile.message);
    });
  },
);

describe.each(LOCALES)('the success page (%s)', (locale) => {
  const dictionary = getDictionary(locale);
  const sent: Shown = { kind: 'sent', status: 200 };

  it('says the message was sent, as a status that assistive technology announces', async () => {
    const html = await render(sent, locale);

    expect(openingTag(html, 'contact-sent')).toContain('role="status"');
    expect(textOf(html, 'contact-sent')).toBe(dictionary.contactSentMessage);
  });

  it('offers to write another message, at the page’s own address', async () => {
    const html = await render(sent, locale);

    expect(html).toContain(`href="${pathnameInLocale('/contact/', locale)}"`);
    expect(decode(html)).toContain(dictionary.contactSentAnother);
  });

  it('shows no form and loads no Turnstile script', async () => {
    const html = await render(sent, locale);

    expect(html).not.toContain('<form');
    expect(html).not.toContain('challenges.cloudflare.com');
  });
});
