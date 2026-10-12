import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { THEME_COLORS } from '../shared/theme/theme-color';
import { readTokenColors } from './read-tokens';

// The browser chrome and the icons are drawn outside the stylesheet, so their colors are copies
// of tokens. These tests are what keeps the copies honest: a change to a token in `tokens.css`
// fails here until the copy follows it, and for the icons that means running
// `node scripts/icons/render.mjs` (see its README) and committing the result.
const tokens = readTokenColors();

const publicFile = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../public/${name}`, import.meta.url)));

describe('THEME_COLORS', () => {
  it('are the background tokens of the light and the dark theme', () => {
    expect(THEME_COLORS).toEqual({
      light: tokens.light.bg,
      dark: tokens.dark.bg,
    });
  });
});

describe('public/icon.svg', () => {
  const readSvg = () => publicFile('icon.svg').toString('utf8');

  it('is the dark icon in both color schemes: the dark background token behind the dark accent token', () => {
    const svg = readSvg();
    expect(/<rect\b[^>]*\bfill="(#[0-9a-f]{6})"/i.exec(svg)?.[1]).toBe(
      tokens.dark.bg,
    );
    expect(/<path\b[^>]*\bstroke="(#[0-9a-f]{6})"/i.exec(svg)?.[1]).toBe(
      tokens.dark.accent,
    );
  });

  it('has no other color and no color scheme switch', () => {
    const svg = readSvg();
    expect(svg).not.toMatch(/prefers-color-scheme|<style/);
    expect(
      [...svg.matchAll(/#[0-9a-f]{6}\b/gi)].map(([color]) =>
        color.toLowerCase(),
      ),
    ).toEqual([tokens.dark.bg, tokens.dark.accent]);
  });
});

/** The width, height and color type that a PNG declares in its IHDR chunk. */
function pngHeader(bytes: Buffer) {
  expect([...bytes.subarray(0, 8)]).toEqual([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}

describe('public/apple-touch-icon.png', () => {
  it('is 180x180 and opaque: a PNG without an alpha channel, which iOS would fill with black', () => {
    // Color type 2 is RGB; 6 is RGBA.
    expect(pngHeader(publicFile('apple-touch-icon.png'))).toEqual({
      width: 180,
      height: 180,
      colorType: 2,
    });
  });
});

describe('public/favicon.ico', () => {
  it('holds a 32 and a 48 pixel picture, as PNGs', () => {
    const ico = publicFile('favicon.ico');
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    const count = ico.readUInt16LE(4);

    const entries = Array.from({ length: count }, (_, index) => {
      const at = 6 + index * 16;
      const size = ico.readUInt32LE(at + 8);
      const offset = ico.readUInt32LE(at + 12);
      return {
        width: ico.readUInt8(at),
        height: ico.readUInt8(at + 1),
        png: pngHeader(ico.subarray(offset, offset + size)),
      };
    });

    expect(entries.map(({ width, height }) => [width, height])).toEqual([
      [32, 32],
      [48, 48],
    ]);
    // What each entry says it is matches the picture inside it.
    expect(entries.map(({ png }) => [png.width, png.height])).toEqual([
      [32, 32],
      [48, 48],
    ]);
  });
});
