import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Test support: reads the colors that other files must agree with from the stylesheet itself
// (`tokens.css`), so those tests fail the moment a token changes, instead of copying the colors
// into a second source of truth. Filesystem-only, like `tokens.test.ts`; the site never imports it.
const TOKENS_FILE = fileURLToPath(new URL('./tokens.css', import.meta.url));

export type TokenColors = Record<'bg' | 'accent', string>;

/** The block that opens at `selector`, up to its first closing brace (the blocks do not nest). */
function blockAt(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) {
    throw new Error(`tokens.css: could not find "${selector}".`);
  }
  return css.slice(start, css.indexOf('}', start));
}

function colorOf(block: string, name: string): string {
  const match = new RegExp(`--token-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(
    block,
  );
  if (!match?.[1]) {
    throw new Error(`tokens.css: missing "--token-${name}" in a block.`);
  }
  return match[1].toLowerCase();
}

/** The page background and the accent of each theme, as lowercase `#rrggbb`. */
export function readTokenColors(): { light: TokenColors; dark: TokenColors } {
  const css = readFileSync(TOKENS_FILE, 'utf8');
  const light = blockAt(css, ':root {');
  const dark = blockAt(css, ":root[data-theme='dark']");

  return {
    light: { bg: colorOf(light, 'bg'), accent: colorOf(light, 'accent') },
    dark: { bg: colorOf(dark, 'bg'), accent: colorOf(dark, 'accent') },
  };
}
