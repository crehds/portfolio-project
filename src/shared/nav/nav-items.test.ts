import { describe, expect, it } from 'vitest';

import { NAV_ITEMS } from './nav-items';

describe('NAV_ITEMS', () => {
  it('lists the routes that exist today: home, projects, experience and skills, in order', () => {
    expect(NAV_ITEMS.map((item) => item.labelKey)).toEqual([
      'navHome',
      'navProjects',
      'navExperience',
      'navSkills',
    ]);
  });

  it("resolves the home entry's href per locale", () => {
    const [home] = NAV_ITEMS;

    expect(home.href('en')).toBe('/');
    expect(home.href('es')).toBe('/es/');
  });

  it("resolves the projects entry's href per locale", () => {
    const [, projects] = NAV_ITEMS;

    expect(projects.href('en')).toBe('/projects/');
    expect(projects.href('es')).toBe('/es/projects/');
  });

  it("resolves the experience entry's href per locale", () => {
    const [, , experience] = NAV_ITEMS;

    expect(experience.href('en')).toBe('/experience/');
    expect(experience.href('es')).toBe('/es/experience/');
  });

  it("resolves the skills entry's href per locale", () => {
    const [, , , skills] = NAV_ITEMS;

    expect(skills.href('en')).toBe('/skills/');
    expect(skills.href('es')).toBe('/es/skills/');
  });
});
