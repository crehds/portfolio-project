import { describe, expect, it } from 'vitest';

import { NAV_ITEMS } from './nav-items';

describe('NAV_ITEMS', () => {
  it('lists only the routes that exist today: the home page', () => {
    expect(NAV_ITEMS).toHaveLength(1);
    expect(NAV_ITEMS[0].labelKey).toBe('navHome');
  });

  it("resolves the home entry's href per locale", () => {
    const [home] = NAV_ITEMS;

    expect(home.href('en')).toBe('/');
    expect(home.href('es')).toBe('/es/');
  });
});
