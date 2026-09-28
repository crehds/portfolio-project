// Pure domain logic: no Astro/Zod imports.

/** An sRGB color as `[red, green, blue]`, each channel `0-255`. */
export type Rgb = readonly [number, number, number];

/**
 * Converts one 0-255 sRGB channel to its linear-light value, per the WCAG 2 relative
 * luminance formula (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
 */
function toLinearChannel(channel255: number): number {
  const channel = channel255 / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** The WCAG 2 relative luminance of an sRGB color, from 0 (black) to 1 (white). */
export function relativeLuminance([r, g, b]: Rgb): number {
  return (
    0.2126 * toLinearChannel(r) +
    0.7152 * toLinearChannel(g) +
    0.0722 * toLinearChannel(b)
  );
}

/**
 * The WCAG 2 contrast ratio between two colors, from 1:1 (identical) to 21:1 (black on
 * white). Order-independent: the lighter color is always treated as the numerator.
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The three WCAG 2.1 AA success criteria this project relies on: 1.4.3 Contrast (Minimum)
 * for normal-size text (4.5:1) and large-scale text (3:1), and 1.4.11 Non-text Contrast for
 * UI component boundaries and focus indicators (3:1).
 */
export type WcagLevel = 'normal-text' | 'large-text' | 'non-text';

const WCAG_AA_MINIMUM_RATIO: Record<WcagLevel, number> = {
  'normal-text': 4.5,
  'large-text': 3,
  'non-text': 3,
};

/** Whether a contrast ratio meets the WCAG 2.1 AA minimum for the given usage. */
export function meetsWcagAA(ratio: number, level: WcagLevel): boolean {
  return ratio >= WCAG_AA_MINIMUM_RATIO[level];
}

const HEX_COLOR_PATTERN = /^[0-9a-fA-F]{6}$/;

/** Parses a 6-digit hex color (with or without a leading `#`) into an `Rgb` triple. */
export function hexToRgb(hex: string): Rgb {
  const normalized = hex.trim().replace(/^#/, '');

  if (!HEX_COLOR_PATTERN.test(normalized)) {
    throw new Error(
      `hexToRgb: expected a 6-digit hex color, received "${hex}".`,
    );
  }

  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}
