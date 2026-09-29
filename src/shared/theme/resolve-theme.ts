// Pure domain logic: no Astro/Zod imports.

export type Theme = 'light' | 'dark';

/**
 * Resolves which theme applies: an explicit stored preference wins over the OS/user-agent
 * preference; anything else (missing, or not exactly "light"/"dark", e.g. corrupted
 * `localStorage`) falls back to the OS preference.
 *
 * Pure so this exact decision is unit-tested here. The `<head>` script in `BaseLayout.astro`
 * that must run before first paint mirrors this same logic as static inline JS instead of
 * importing this module, because a pre-paint script cannot import an ES module and still stay
 * a stable, literal string for a future CSP hash (T13) - see the comment there.
 */
export function resolveTheme(
  storedPreference: string | null | undefined,
  prefersDarkOS: boolean,
): Theme {
  if (storedPreference === 'light' || storedPreference === 'dark') {
    return storedPreference;
  }

  return prefersDarkOS ? 'dark' : 'light';
}
