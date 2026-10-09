// Decorative icon markup for the contact CTAs (`ContactCtas.astro`). Each CTA already
// carries its own visible text label, so these are purely decorative and marked
// `aria-hidden` - the accessible name never depends on them.
//
// WhatsApp/LinkedIn/GitHub use Tabler Icons' outline `brand-*` marks (MIT license; see
// `THIRD_PARTY_NOTICES.md` and `node_modules/@tabler/icons/LICENSE`), imported below
// with Vite's `?raw` suffix. This module is only ever imported from Astro frontmatter
// (never a `<script>`), so the raw markup is inlined into the prerendered HTML at
// build time and nothing ships as client JS. Simple Icons (CC0) was tried first, but
// its published package no longer includes a LinkedIn icon (removed at LinkedIn's
// request, per its own DISCLAIMER.md "Removal of Brands" policy) - one consistent set
// for all three brand marks mattered more than using Simple Icons for two of them and
// something else for the third. Tabler's outline style (24x24, `stroke="currentColor"`,
// `stroke-width="2"`, round caps/joins) already matches this project's stroke-icon
// language (see `ThemeToggle.astro`'s sun/moon icons).
//
// Email and CV are not brand marks, so they keep T08's original hand-drawn glyphs
// instead of pulling in an icon package for them too.
import brandGithub from '@tabler/icons/outline/brand-github.svg?raw';
import brandLinkedin from '@tabler/icons/outline/brand-linkedin.svg?raw';
import brandWhatsapp from '@tabler/icons/outline/brand-whatsapp.svg?raw';

import type { ContactCtaId } from '../../modules/profile/domain/build-contact-ctas';

const ICON_SIZE_PX = 18;

/**
 * Adapts a Tabler icon (published as 24x24, with no `aria-hidden`) to match this
 * row's other, hand-drawn icons: same rendered size, and marked purely decorative.
 * A plain string substitution rather than an XML parser, because the input is one
 * fixed, version-pinned asset upgraded deliberately - not arbitrary/untrusted SVG -
 * see this function's own test for a regression guard if a future Tabler release
 * reformats the published file in a way this substitution can no longer match.
 */
export function sizedAriaHiddenIcon(svg: string, sizePx: number): string {
  return svg
    .replace('width="24"', `width="${sizePx}"`)
    .replace('height="24"', `height="${sizePx}"`)
    .replace('<svg\n', '<svg\n  aria-hidden="true"\n  focusable="false"\n');
}

const ICON_ATTRS =
  'viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

export const CONTACT_CTA_ICONS: Record<ContactCtaId, string> = {
  // A speech bubble with its tail at the bottom left (hand-drawn; not a brand mark).
  form: `<svg ${ICON_ATTRS}><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"></path></svg>`,
  whatsapp: sizedAriaHiddenIcon(brandWhatsapp, ICON_SIZE_PX),
  // A classic envelope (hand-drawn; not a brand mark, see the module comment above).
  email: `<svg ${ICON_ATTRS}><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path></svg>`,
  linkedin: sizedAriaHiddenIcon(brandLinkedin, ICON_SIZE_PX),
  github: sizedAriaHiddenIcon(brandGithub, ICON_SIZE_PX),
  // A download arrow into a tray (hand-drawn; not a brand mark).
  cv: `<svg ${ICON_ATTRS}><path d="M12 4v11"></path><path d="M7.5 11.5 12 16l4.5-4.5"></path><path d="M5 19h14"></path></svg>`,
};
