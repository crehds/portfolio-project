// Regenerates the site's icons in public/ from the dark tokens of src/styles/tokens.css:
//
//   public/icon.svg             the icon, one picture for both color schemes
//   public/favicon.ico          32 and 48 pixel PNGs, for the browsers that do not read the SVG
//   public/apple-touch-icon.png 180x180, opaque (iOS fills transparency with black)
//
//   node scripts/icons/render.mjs
//
// A manual tool: it is not part of the build or of CI. Run it after changing the background or
// the accent of the dark theme, and commit the files; src/styles/icons.test.ts fails until you do.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { darkTokens } from '../lib/design-tokens.mjs';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const publicDir = path.join(repoRoot, 'public');
const { bg, accent } = darkTokens(repoRoot);

// The `>_` mark, on a 64x64 canvas.
const MARK = 'M17 20 31 32 17 44M36 46H49';
const STROKE = `fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`;

// The icon is the dark one in both color schemes (a light variant is a white mark on a blue
// square, which reads as another product's icon), so it needs no `prefers-color-scheme` switch.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${bg}"/>
  <path d="${MARK}" ${STROKE}/>
</svg>
`;

// The touch icon is a full square (iOS rounds the corners itself), with the mark a little
// smaller so the rounding does not clip it.
const touchIconHtml = (size) => `<!doctype html><html><head><style>
  * { margin: 0 }
  body { width: ${size}px; height: ${size}px; background: ${bg} }
  svg { width: ${size}px; height: ${size}px; display: block }
</style></head><body>
  <svg viewBox="-3 -3 70 70"><path d="${MARK}" ${STROKE}/></svg>
</body></html>`;

/** Packs PNG pictures into one ICO file (an ICO may hold PNGs since Windows Vista). */
function packIco(pictures) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pictures.length, 4);
  let offset = 6 + 16 * pictures.length;
  const entries = [];
  for (const { size, png } of pictures) {
    const entry = Buffer.alloc(16);
    entry[0] = size;
    entry[1] = size;
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...pictures.map(({ png }) => png)]);
}

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'icon.svg'), iconSvg);

const browser = await chromium.launch();
try {
  // The SVG at each size, with transparent corners.
  const pictures = [];
  for (const size of [32, 48]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    const sized = iconSvg.replace(
      '<svg ',
      `<svg width="${size}" height="${size}" `,
    );
    await page.setContent(
      `<body style="margin:0;background:transparent">${sized}</body>`,
    );
    pictures.push({
      size,
      png: await page.screenshot({ omitBackground: true }),
    });
    await page.close();
  }
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), packIco(pictures));

  const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await page.setContent(touchIconHtml(180));
  await page.screenshot({ path: path.join(publicDir, 'apple-touch-icon.png') });
  await page.close();
} finally {
  await browser.close();
}
console.log(
  'wrote public/icon.svg, public/favicon.ico, public/apple-touch-icon.png',
);
