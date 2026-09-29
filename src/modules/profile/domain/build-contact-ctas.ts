// Pure domain logic: no Astro/Zod imports.
import { whatsappLink } from './whatsapp-link';

export type ContactCtaId = 'whatsapp' | 'email' | 'linkedin' | 'github' | 'cv';

export interface ContactCta {
  id: ContactCtaId;
  href: string;
}

export interface ContactCtaProfile {
  whatsapp: string;
  email: string;
  linkedin: string;
  github: string;
  /** The CV file's locale-resolved href. Omitted until the profile `cv` field is set
   * (T11 serves the file from R2 - see the "CV download" decision). */
  cv?: string;
}

/**
 * Builds the home page's contact call-to-action list, in display order. WhatsApp,
 * email, LinkedIn and GitHub always come from the profile; the CV download only
 * appears once `profile.cv` is set.
 */
export function buildContactCtas(profile: ContactCtaProfile): ContactCta[] {
  const ctas: ContactCta[] = [
    { id: 'whatsapp', href: whatsappLink(profile.whatsapp) },
    { id: 'email', href: `mailto:${profile.email}` },
    { id: 'linkedin', href: profile.linkedin },
    { id: 'github', href: profile.github },
  ];

  if (profile.cv) {
    ctas.push({ id: 'cv', href: profile.cv });
  }

  return ctas;
}
