import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The rules that hide what needs JavaScript while `<html class="no-js">` is still there live in
// `global.css`, and they must stay outside any `@layer`: Tailwind v4 puts its utilities in
// layers, an unlayered rule beats every layered one whatever the specificity, and the form
// carries `flex` (a `display` utility) that a layered rule could not override. A component's
// own `<style>` cannot hold them either, since Astro would scope the `.no-js` ancestor
// selector to the component. See the T07 note in odd/tasks/portfolio-astro-rebuild.md.
// Comments are dropped first: they mention the selectors, and a mention is not a rule.
const css = readFileSync(
  new URL('./global.css', import.meta.url),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/** Whether the first occurrence of `selector` sits at the top level of the file. */
function isTopLevel(selector: string): boolean {
  const at = css.indexOf(selector);
  if (at < 0) {
    throw new Error(`global.css has no rule for ${selector}`);
  }

  let depth = 0;
  for (const character of css.slice(0, at)) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
  }
  return depth === 0;
}

/** The declarations of the first rule whose selector is exactly `selector`. */
function declarationsOf(selector: string): string {
  const match = new RegExp(
    `(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
  ).exec(css);
  if (!match) {
    throw new Error(`global.css has no rule for ${selector}`);
  }
  return match[1].replace(/\s+/g, ' ').trim();
}

describe('the rules for a visitor without JavaScript', () => {
  it.each([
    '.no-js .theme-toggle',
    '.contact-nojs',
    '.no-js .contact-nojs',
    '.no-js .contact-form-only',
  ])('keep %s outside every cascade layer', (selector) => {
    expect(isTopLevel(selector)).toBe(true);
  });

  it('hide the notice until JavaScript is known to be off, and show it then', () => {
    expect(declarationsOf('.contact-nojs')).toBe('display: none;');
    expect(declarationsOf('.no-js .contact-nojs')).toBe('display: block;');
  });

  it('hide the form, its lead and the list of other ways while JavaScript is off', () => {
    expect(declarationsOf('.no-js .contact-form-only')).toBe('display: none;');
  });

  it('are written after the layers, so no later rule can sit between them and the utilities', () => {
    const lastLayer = css.lastIndexOf('@layer');

    expect(css.indexOf('.contact-nojs')).toBeGreaterThan(lastLayer);
    expect(css.indexOf('.no-js .contact-form-only')).toBeGreaterThan(lastLayer);
  });
});
