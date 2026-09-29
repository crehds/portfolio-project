// Decorative icon markup for the contact CTAs (`ContactCtas.astro`). Each CTA already
// carries its own visible text label, so these are purely decorative and marked
// `aria-hidden` - the accessible name never depends on them.
//
// These are original, simple stroke glyphs authored for this project, matching the
// stroke style `ThemeToggle.astro`'s sun/moon icons already use (24x24 viewBox,
// `stroke="currentColor"`, `stroke-width="2"`, round caps/joins, no fill). They are not
// reproductions of any third-party brand mark (e.g. Simple Icons' WhatsApp/LinkedIn/
// GitHub logos): this task's network authorization covered only the one avatar
// download, so there was no way to fetch and verify pixel-perfect brand path data. As
// original work, no third-party license applies. A follow-up task could swap these for
// exact CC0-licensed Simple Icons marks once that fetch is authorized.
import type { ContactCtaId } from '../../modules/profile/domain/build-contact-ctas';

const ICON_ATTRS =
  'viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

export const CONTACT_CTA_ICONS: Record<ContactCtaId, string> = {
  // A speech bubble with a tail: a generic "message" glyph standing in for WhatsApp.
  whatsapp: `<svg ${ICON_ATTRS}><path d="M4 4h16v12H9l-4 4v-4H4z"></path></svg>`,
  // A classic envelope.
  email: `<svg ${ICON_ATTRS}><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path></svg>`,
  // A generic profile/contact badge standing in for LinkedIn.
  linkedin: `<svg ${ICON_ATTRS}><rect x="3" y="3" width="18" height="18" rx="3"></rect><circle cx="12" cy="9" r="3"></circle><path d="M6 19Q12 11 18 19"></path></svg>`,
  // A branch/fork glyph: a generic version-control mark standing in for GitHub.
  github: `<svg ${ICON_ATTRS}><circle cx="6" cy="6" r="2.5"></circle><circle cx="6" cy="18" r="2.5"></circle><circle cx="18" cy="7" r="2.5"></circle><path d="M6 8.5V15.5"></path><path d="M6 12Q11 12 15.5 7.5"></path></svg>`,
  // A download arrow into a tray, for the CV file.
  cv: `<svg ${ICON_ATTRS}><path d="M12 4v11"></path><path d="M7.5 11.5 12 16l4.5-4.5"></path><path d="M5 19h14"></path></svg>`,
};
