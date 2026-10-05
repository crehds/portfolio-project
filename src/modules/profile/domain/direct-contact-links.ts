// Pure domain logic: no Astro/Zod imports.
import { whatsappLink } from './whatsapp-link';

export type DirectContactId = 'whatsapp' | 'email';

export interface DirectContactLink {
  id: DirectContactId;
  href: string;
}

export interface DirectContactProfile {
  /** The E.164 number, e.g. "+51970791041" (see `profileSchema`). */
  whatsapp: string;
  email: string;
}

/**
 * The two ways to reach the owner without the contact form, in display order: WhatsApp,
 * then email. The contact page offers them next to the form, and the notice that takes
 * the form's place (no JavaScript, or a form that cannot send) is made of them. The home
 * page's call-to-action list (`buildContactCtas`) starts from the same two.
 */
export function directContactLinks(
  profile: DirectContactProfile,
): DirectContactLink[] {
  return [
    { id: 'whatsapp', href: whatsappLink(profile.whatsapp) },
    { id: 'email', href: `mailto:${profile.email}` },
  ];
}
