import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import type { ContactCtaId } from '../../modules/profile/domain/build-contact-ctas';
import { LOCALES, type Locale } from '../../shared/i18n/locales';
import { pathnameInLocale } from '../../shared/i18n/paths';
import ContactCtaButton from './ContactCtaButton.astro';
import { CONTACT_CTA_ICONS } from './contact-cta-icons';

// The button both lists of contact links are made of, the home page's (`ContactCtas`) and
// the contact page's (`DirectContactLinks`), rendered by Astro's container and read back as
// HTML. It is what keeps the two lists alike, so it is held to one class string, and to one
// icon and one label for each id in each locale.

const CLASSES =
  'inline-flex min-h-11 items-center gap-2 rounded border border-border px-3 py-2 text-text';

/** The label of each button, spelled out here instead of read from the dictionary. */
const LABELS: Record<Locale, Record<ContactCtaId, string>> = {
  en: {
    form: 'Send a message',
    whatsapp: 'WhatsApp',
    email: 'Email',
    linkedin: 'LinkedIn',
    github: 'GitHub',
    cv: 'Download CV',
  },
  es: {
    form: 'Enviar un mensaje',
    whatsapp: 'WhatsApp',
    email: 'Correo electrónico',
    linkedin: 'LinkedIn',
    github: 'GitHub',
    cv: 'Descargar CV',
  },
};

async function render(id: ContactCtaId, locale: Locale): Promise<string> {
  const container = await AstroContainer.create();

  return container.renderToString(ContactCtaButton, {
    request: new Request(`http://localhost${pathnameInLocale('/', locale)}`),
    props: { id, href: '/somewhere/' },
  });
}

describe.each(LOCALES)('the contact CTA button (%s)', (locale) => {
  const ids = Object.keys(LABELS[locale]) as ContactCtaId[];

  it.each(ids)(
    'is a link in the shared look, with the icon of %s',
    async (id) => {
      const html = await render(id, locale);

      expect(/<a\b[^>]*\shref="([^"]*)"/.exec(html)?.[1]).toBe('/somewhere/');
      expect(/<a\b[^>]*\sclass="([^"]*)"/.exec(html)?.[1]).toBe(CLASSES);
      expect(html).toContain(CONTACT_CTA_ICONS[id]);
    },
  );

  it.each(ids)(
    'says nothing but the label of %s besides its icon',
    async (id) => {
      const html = await render(id, locale);

      const text = html
        .replace(CONTACT_CTA_ICONS[id], '')
        .replace(/<[^>]*>/g, '')
        .trim();
      expect(text).toBe(LABELS[locale][id]);
    },
  );
});
