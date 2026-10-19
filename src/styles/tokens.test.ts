import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  hexToRgb,
  type Rgb,
  type WcagLevel,
} from '../shared/color/contrast';

// Filesystem-only check (no `astro:*` imports): reads the actual stylesheet so the test
// fails the moment a token value regresses below AA, instead of duplicating the colors as
// a second, driftable source of truth. See the file-level comment in `tokens.css`.
const TOKENS_FILE = fileURLToPath(new URL('./tokens.css', import.meta.url));

const TOKEN_NAMES = [
  'bg',
  'surface',
  'text',
  'text-muted',
  'accent',
  'highlight',
  'border',
  'focus',
] as const;
type TokenName = (typeof TOKEN_NAMES)[number];

/**
 * Slices the declaration body of the first brace-delimited block whose opening line
 * contains `selector` (simple, non-nested brace counting - sufficient for this file).
 */
function sliceRuleBody(css: string, selector: string): string {
  const selectorIndex = css.indexOf(selector);
  if (selectorIndex === -1) {
    throw new Error(
      `tokens.css: could not find a rule starting with "${selector}".`,
    );
  }

  const braceOpen = css.indexOf('{', selectorIndex);
  let depth = 0;
  let index = braceOpen;
  for (; index < css.length; index++) {
    if (css[index] === '{') depth++;
    else if (css[index] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }

  if (depth !== 0) {
    throw new Error(`tokens.css: unbalanced braces after "${selector}".`);
  }

  return css.slice(braceOpen + 1, index);
}

function parseTokens(ruleBody: string): Record<TokenName, Rgb> {
  const tokens = {} as Record<TokenName, Rgb>;

  for (const name of TOKEN_NAMES) {
    const match = new RegExp(`--token-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(
      ruleBody,
    );
    if (!match) {
      throw new Error(
        `tokens.css: missing "--token-${name}" in the parsed rule.`,
      );
    }
    tokens[name] = hexToRgb(match[1]);
  }

  return tokens;
}

interface Pair {
  readonly description: string;
  readonly foreground: TokenName;
  readonly background: TokenName;
  readonly level: WcagLevel;
}

// WCAG 1.4.3 Contrast (Minimum): text-carrying tokens against each background they render on.
const TEXT_PAIRS: readonly Pair[] = [
  {
    description: 'body text on the page background',
    foreground: 'text',
    background: 'bg',
    level: 'normal-text',
  },
  {
    description: 'body text on a surface panel',
    foreground: 'text',
    background: 'surface',
    level: 'normal-text',
  },
  {
    description: 'muted text on the page background',
    foreground: 'text-muted',
    background: 'bg',
    level: 'normal-text',
  },
  {
    description: 'muted text on a surface panel',
    foreground: 'text-muted',
    background: 'surface',
    level: 'normal-text',
  },
  {
    description: 'accent (links) on the page background',
    foreground: 'accent',
    background: 'bg',
    level: 'normal-text',
  },
  {
    description: 'accent (links) on a surface panel',
    foreground: 'accent',
    background: 'surface',
    level: 'normal-text',
  },
  {
    description: 'highlight on the page background',
    foreground: 'highlight',
    background: 'bg',
    level: 'normal-text',
  },
  {
    description: 'highlight on a surface panel',
    foreground: 'highlight',
    background: 'surface',
    level: 'normal-text',
  },
];

// WCAG 1.4.11 Non-text Contrast: borders and focus indicators against each background.
const NON_TEXT_PAIRS: readonly Pair[] = [
  {
    description: 'border on the page background',
    foreground: 'border',
    background: 'bg',
    level: 'non-text',
  },
  {
    description: 'border on a surface panel',
    foreground: 'border',
    background: 'surface',
    level: 'non-text',
  },
  {
    description: 'focus indicator on the page background',
    foreground: 'focus',
    background: 'bg',
    level: 'non-text',
  },
  {
    description: 'focus indicator on a surface panel',
    foreground: 'focus',
    background: 'surface',
    level: 'non-text',
  },
];

const ALL_PAIRS: readonly Pair[] = [...TEXT_PAIRS, ...NON_TEXT_PAIRS];

const MIN_RATIO: Record<WcagLevel, number> = {
  'normal-text': 4.5,
  'large-text': 3,
  'non-text': 3,
};

describe('design tokens contrast (AA)', () => {
  const css = readFileSync(TOKENS_FILE, 'utf-8');

  const lightTokens = parseTokens(sliceRuleBody(css, ':root {'));
  const darkTokens = parseTokens(
    sliceRuleBody(css, ":root[data-theme='dark'] {"),
  );
  const darkOsTokens = parseTokens(
    sliceRuleBody(css, ":root:not([data-theme='light']) {"),
  );

  it('applies the same dark values whether the OS or the toggle triggers them', () => {
    expect(darkOsTokens).toEqual(darkTokens);
  });

  const themes: Record<string, Record<TokenName, Rgb>> = {
    light: lightTokens,
    dark: darkTokens,
  };

  for (const [themeName, tokens] of Object.entries(themes)) {
    describe(`${themeName} theme`, () => {
      for (const pair of ALL_PAIRS) {
        it(`${pair.description} meets ${MIN_RATIO[pair.level]}:1`, () => {
          const ratio = contrastRatio(
            tokens[pair.foreground],
            tokens[pair.background],
          );

          expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO[pair.level]);
        });
      }
    });
  }
});
