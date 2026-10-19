// Reads the site's design tokens (src/styles/tokens.css) for the generators in scripts/, so the
// pictures they draw take their colors from the same place the site does.
import fs from 'node:fs';
import path from 'node:path';

const TOKENS_FILE = ['src', 'styles', 'tokens.css'];

/** The value of a `--token-*` custom property in the first block that starts with `selector`. */
function tokenValue(css, selector, name) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`tokens.css has no "${selector}" block.`);
  const body = css.slice(start, css.indexOf('}', start));
  const match = new RegExp(`--token-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(
    body,
  );
  if (!match) {
    throw new Error(`tokens.css: no --token-${name} in "${selector}".`);
  }
  return match[1].toLowerCase();
}

/** The dark theme's colors: `{ bg, text, accent }` as `#rrggbb`. */
export function darkTokens(repoRoot) {
  const css = fs.readFileSync(path.join(repoRoot, ...TOKENS_FILE), 'utf8');
  const selector = ":root[data-theme='dark']";
  return {
    bg: tokenValue(css, selector, 'bg'),
    text: tokenValue(css, selector, 'text'),
    accent: tokenValue(css, selector, 'accent'),
  };
}
