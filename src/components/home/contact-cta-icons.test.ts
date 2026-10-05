import { describe, expect, it } from 'vitest';

import { CONTACT_CTA_ICONS, sizedAriaHiddenIcon } from './contact-cta-icons';

// A representative sample of Tabler Icons' published outline format (see
// node_modules/@tabler/icons/icons/outline/brand-github.svg), trimmed to one path so
// the test stays readable. `sizedAriaHiddenIcon` is a plain string substitution (not
// an XML parser), so this guards it against a future Tabler release reformatting the
// file in a way the substitution can no longer match.
const SAMPLE_TABLER_SVG = `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="icon icon-tabler icons-tabler-outline icon-tabler-brand-github"
>
  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
  <path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3" />
</svg>`;

describe('sizedAriaHiddenIcon', () => {
  it('resizes the published 24x24 width/height attributes', () => {
    const result = sizedAriaHiddenIcon(SAMPLE_TABLER_SVG, 18);

    expect(result).toContain('width="18"');
    expect(result).toContain('height="18"');
    expect(result).not.toContain('width="24"');
    expect(result).not.toContain('height="24"');
  });

  it('marks the icon aria-hidden and unfocusable', () => {
    const result = sizedAriaHiddenIcon(SAMPLE_TABLER_SVG, 18);

    expect(result).toContain('aria-hidden="true"');
    expect(result).toContain('focusable="false"');
  });

  it('preserves the icon path data unchanged', () => {
    const result = sizedAriaHiddenIcon(SAMPLE_TABLER_SVG, 18);

    expect(result).toContain('d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3"');
  });
});

describe('CONTACT_CTA_ICONS', () => {
  it('has an entry for every contact cta id', () => {
    expect(Object.keys(CONTACT_CTA_ICONS).sort()).toEqual(
      ['cv', 'email', 'form', 'github', 'linkedin', 'whatsapp'].sort(),
    );
  });

  it('marks the whatsapp, linkedin and github brand icons aria-hidden at 18px', () => {
    for (const id of ['whatsapp', 'linkedin', 'github'] as const) {
      expect(CONTACT_CTA_ICONS[id]).toContain('aria-hidden="true"');
      expect(CONTACT_CTA_ICONS[id]).toContain('width="18"');
      expect(CONTACT_CTA_ICONS[id]).toContain('height="18"');
    }
  });

  it('marks the hand-drawn form, email and cv icons aria-hidden, unfocusable and 18px', () => {
    for (const id of ['form', 'email', 'cv'] as const) {
      expect(CONTACT_CTA_ICONS[id]).toContain('aria-hidden="true"');
      expect(CONTACT_CTA_ICONS[id]).toContain('focusable="false"');
      expect(CONTACT_CTA_ICONS[id]).toContain('width="18"');
      expect(CONTACT_CTA_ICONS[id]).toContain('height="18"');
    }
  });

  it('draws every icon in its own right: no two share the same markup', () => {
    const markup = Object.values(CONTACT_CTA_ICONS);

    expect(new Set(markup).size).toBe(markup.length);
  });
});
