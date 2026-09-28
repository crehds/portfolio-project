import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  hexToRgb,
  meetsWcagAA,
  relativeLuminance,
} from './contrast';

describe('relativeLuminance', () => {
  it('is 0 for black', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
  });

  it('is 1 for white', () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white, the maximum possible ratio', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
  });

  it('is 1:1 for a color against itself', () => {
    expect(contrastRatio([112, 212, 231], [112, 212, 231])).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    const a: [number, number, number] = [22, 26, 23];
    const b: [number, number, number] = [226, 230, 227];

    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe('meetsWcagAA', () => {
  it('requires at least 4.5:1 for normal text', () => {
    expect(meetsWcagAA(4.5, 'normal-text')).toBe(true);
    expect(meetsWcagAA(4.49, 'normal-text')).toBe(false);
  });

  it('requires at least 3:1 for large text', () => {
    expect(meetsWcagAA(3, 'large-text')).toBe(true);
    expect(meetsWcagAA(2.99, 'large-text')).toBe(false);
  });

  it('requires at least 3:1 for non-text UI components', () => {
    expect(meetsWcagAA(3, 'non-text')).toBe(true);
    expect(meetsWcagAA(2.99, 'non-text')).toBe(false);
  });
});

describe('hexToRgb', () => {
  it('parses a 6-digit hex color with a leading #', () => {
    expect(hexToRgb('#70d4e7')).toEqual([112, 212, 231]);
  });

  it('parses a 6-digit hex color without a leading #', () => {
    expect(hexToRgb('161a17')).toEqual([22, 26, 23]);
  });

  it('is case-insensitive', () => {
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255]);
  });

  it('throws on an invalid hex color', () => {
    expect(() => hexToRgb('#fff')).toThrow();
    expect(() => hexToRgb('not-a-color')).toThrow();
  });
});
