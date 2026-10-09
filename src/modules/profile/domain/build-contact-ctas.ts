// Pure domain logic: no Astro/Zod imports.
import { directContactLinks } from './direct-contact-links';

export type ContactCtaId =
  'form' | 'whatsapp' | 'email' | 'linkedin' | 'github' | 'cv';

export interface ContactCta {
  id: ContactCtaId;
  href: string;
}

export interface ContactCtaProfile {
  /** The contact page's pathname in the page's locale (see `NAV_ITEMS`). */
  form: string;
  whatsapp: string;
  email: string;
  linkedin: string;
  github: string;
  /** The CV file's locale-resolved href. Omitted until the profile `cv` field is set
   * (T11 serves the file from R2 - see the "CV download" decision). */
  cv?: string;
}

/**
 * Builds the home page's contact call-to-action list, in display order. The contact form
 * leads (it is the way the site asks people to write), then WhatsApp and email (see
 * `directContactLinks`), LinkedIn and GitHub, which always come from the profile; the CV
 * download only appears once `profile.cv` is set.
 */
export function buildContactCtas(profile: ContactCtaProfile): ContactCta[] {
  const ctas: ContactCta[] = [
    { id: 'form', href: profile.form },
    ...directContactLinks(profile),
    { id: 'linkedin', href: profile.linkedin },
    { id: 'github', href: profile.github },
  ];

  if (profile.cv) {
    ctas.push({ id: 'cv', href: profile.cv });
  }

  return ctas;
}
