import { describe, expect, it } from 'vitest';

import { isStoredTheme, resolveTheme } from './resolve-theme';

describe('resolveTheme', () => {
  it('uses the stored preference when it is "dark", even if the OS prefers light', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('uses the stored preference when it is "light", even if the OS prefers dark', () => {
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('falls back to the OS preference when nothing is stored (null)', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('falls back to the OS preference when nothing is stored (undefined)', () => {
    expect(resolveTheme(undefined, true)).toBe('dark');
    expect(resolveTheme(undefined, false)).toBe('light');
  });

  it('falls back to the OS preference for an unrecognized stored value', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('', false)).toBe('light');
  });
});

describe('isStoredTheme', () => {
  it('recognizes "light" and "dark" as a stored theme', () => {
    expect(isStoredTheme('light')).toBe(true);
    expect(isStoredTheme('dark')).toBe(true);
  });

  it('rejects missing or unrecognized values', () => {
    expect(isStoredTheme(null)).toBe(false);
    expect(isStoredTheme(undefined)).toBe(false);
    expect(isStoredTheme('system')).toBe(false);
    expect(isStoredTheme('')).toBe(false);
  });
});
