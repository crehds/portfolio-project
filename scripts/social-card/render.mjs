// Regenerates the default social cards, src/assets/og/og-card-{en,es}.png (1200x630).
//
//   pnpm build                          # once, so Astro's font cache has the Ubuntu fonts
//   node scripts/social-card/render.mjs
//
// A manual tool: it is not part of the build or of CI. Run it after changing the dark tokens
// in src/styles/tokens.css (the accent, T10d), the name or the role in src/content/profile.yaml,
// or card.html, and commit the PNGs.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import { darkTokens } from '../lib/design-tokens.mjs';
import { cachedFonts } from './fonts.mjs';
import { readCardText } from './profile.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const template = pathToFileURL(
  path.join(repoRoot, 'scripts', 'social-card', 'card.html'),
).href;

const tokens = darkTokens(repoRoot);
const fonts = cachedFonts(repoRoot);
const text = readCardText(repoRoot);

function fontFace(family, weight, fontName) {
  if (!fonts[fontName]) {
    throw new Error(`"${fontName}" is not in Astro's font cache.`);
  }
  const url = pathToFileURL(fonts[fontName]).href;
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(${url}) format('woff2')}`;
}

const styles = [
  fontFace('Ubuntu', 700, 'Ubuntu Bold'),
  fontFace('Ubuntu Mono', 400, 'Ubuntu Mono'),
  `:root{--bg:${tokens.bg};--text:${tokens.text};--accent:${tokens.accent}}`,
].join('\n');

const browser = await chromium.launch();
try {
  for (const locale of ['en', 'es']) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
    });
    const page = await context.newPage();
    await page.goto(template);
    await page.addStyleTag({ content: styles });
    await page.evaluate(
      ([name, role]) => {
        document.getElementById('name').textContent = name;
        document.getElementById('role').textContent = role;
      },
      [text.name, text.role[locale]],
    );
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() =>
      [...document.fonts]
        .filter((font) => font.status === 'loaded')
        .map((font) => `${font.family} ${font.weight}`),
    );
    if (loaded.length !== 2) {
      throw new Error(`Expected both fonts to load, got: ${loaded.join(', ')}`);
    }
    const file = path.join(
      repoRoot,
      'src',
      'assets',
      'og',
      `og-card-${locale}.png`,
    );
    await page.screenshot({ path: file });
    console.log(`wrote ${path.relative(repoRoot, file)}`);
    await context.close();
  }
} finally {
  await browser.close();
}
