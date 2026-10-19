// Pure domain logic: no Astro/Zod imports.

export type Theme = 'light' | 'dark';

/**
 * Narrows a stored preference string to a recognized `Theme`; anything else (missing, or not
 * exactly "light"/"dark", e.g. corrupted `localStorage`) is not one, and callers should fall
 * back to (or keep following) the OS preference instead.
 *
 * Exported (not just inlined in `resolveTheme` below) so the "keep following a live OS
 * change while nothing is stored" listener - mirrored by hand in `BaseLayout.astro`'s inline
 * script, since that script cannot import this module and stay static - shares this exact
 * condition by name with the initial resolution below.
 */
export function isStoredTheme(
  storedPreference: string | null | undefined,
): storedPreference is Theme {
  return storedPreference === 'light' || storedPreference === 'dark';
}

/**
 * Resolves which theme applies: an explicit stored preference wins over the OS/user-agent
 * preference; anything else falls back to the OS preference.
 *
 * Pure so this exact decision is unit-tested here. The `<head>` script in `BaseLayout.astro`
 * that must run before first paint mirrors this same logic (and `isStoredTheme` itself) as
 * static inline JS instead of importing this module, because a pre-paint script cannot import
 * an ES module and still stay a stable, literal string for a future CSP hash (T13) - see the
 * comment there.
 */
export function resolveTheme(
  storedPreference: string | null | undefined,
  prefersDarkOS: boolean,
): Theme {
  if (isStoredTheme(storedPreference)) {
    return storedPreference;
  }

  return prefersDarkOS ? 'dark' : 'light';
}
