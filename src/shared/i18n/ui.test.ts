import { describe, expect, it } from 'vitest';

import { LOCALES } from './locales';
import { getDictionary } from './ui';

describe('getDictionary', () => {
  it('has the same keys for every locale', () => {
    const [reference, ...rest] = LOCALES.map((locale) =>
      Object.keys(getDictionary(locale)).sort(),
    );

    for (const keys of rest) {
      expect(keys).toEqual(reference);
    }
  });

  it('has a non-empty string for every key in every locale', () => {
    for (const locale of LOCALES) {
      const dictionary = getDictionary(locale);

      for (const [key, value] of Object.entries(dictionary)) {
        expect(typeof value, `${locale}.${key}`).toBe('string');
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('returns the expected english strings', () => {
    expect(getDictionary('en')).toEqual({
      siteTitle: 'Carlos Rodríguez Huerta',
      siteDescription:
        'Portfolio of Carlos Rodríguez Huerta, full-stack web developer. Rebuild in progress.',
      rebuildNotice: 'Portfolio rebuild in progress.',
      languageSwitcherLabel: 'Language switcher',
      themeToggleLabel: 'Toggle color theme',
      skipLinkLabel: 'Skip to main content',
      primaryNavLabel: 'Primary navigation',
      navHome: 'Home',
      navProjects: 'Projects',
      navExperience: 'Experience',
      navSkills: 'Skills',
      footerGithubLabel: 'GitHub',
      footerLinkedinLabel: 'LinkedIn',
      footerEmailLabel: 'Email',
      heroPhotoAlt: 'Portrait of',
      ctaWhatsappLabel: 'WhatsApp',
      ctaEmailLabel: 'Email',
      ctaLinkedinLabel: 'LinkedIn',
      ctaGithubLabel: 'GitHub',
      ctaCvLabel: 'Download CV',
      featuredProjectsHeading: 'Featured projects',
      projectLiveLabel: 'Live site',
      projectRepoLabel: 'Repository',
      projectCoverAlt: 'Screenshot of',
      projectLastUpdatedLabel: 'Last updated',
      projectsPageTitle: 'Projects — Carlos Rodríguez Huerta',
      projectsPageDescription:
        'Projects built by Carlos Rodríguez Huerta, full-stack web developer.',
      projectsPageHeading: 'Projects',
      projectsBackLabel: 'Back to projects',
      experienceHeading: 'Experience',
      experiencePageTitle: 'Experience — Carlos Rodríguez Huerta',
      experiencePageDescription:
        'Professional experience of Carlos Rodríguez Huerta, full-stack web developer.',
      experiencePageHeading: 'Experience',
      experienceSeeFullLabel: 'See full experience',
      employmentTypeFullTime: 'Full-time',
      employmentTypePartTime: 'Part-time',
      employmentTypeFreelance: 'Freelance',
      employmentTypeContract: 'Contract',
      skillsPageTitle: 'Skills — Carlos Rodríguez Huerta',
      skillsPageDescription:
        'Technical skills of Carlos Rodríguez Huerta, full-stack web developer.',
      skillsPageHeading: 'Skills',
      skillCategoryFrontend: 'Frontend',
      skillCategoryBackend: 'Backend',
      skillCategoryData: 'Data',
      skillCategoryDevops: 'DevOps',
      skillCategoryTesting: 'Testing',
      skillCategoryTools: 'Tools',
    });
  });

  it('returns the expected spanish strings', () => {
    expect(getDictionary('es')).toEqual({
      siteTitle: 'Carlos Rodríguez Huerta',
      siteDescription:
        'Portafolio de Carlos Rodríguez Huerta, desarrollador web full-stack. Reconstrucción en curso.',
      rebuildNotice: 'Portafolio en reconstrucción.',
      languageSwitcherLabel: 'Selector de idioma',
      themeToggleLabel: 'Cambiar tema de color',
      skipLinkLabel: 'Saltar al contenido principal',
      primaryNavLabel: 'Navegación principal',
      navHome: 'Inicio',
      navProjects: 'Proyectos',
      navExperience: 'Experiencia',
      navSkills: 'Habilidades',
      footerGithubLabel: 'GitHub',
      footerLinkedinLabel: 'LinkedIn',
      footerEmailLabel: 'Correo electrónico',
      heroPhotoAlt: 'Retrato de',
      ctaWhatsappLabel: 'WhatsApp',
      ctaEmailLabel: 'Correo electrónico',
      ctaLinkedinLabel: 'LinkedIn',
      ctaGithubLabel: 'GitHub',
      ctaCvLabel: 'Descargar CV',
      featuredProjectsHeading: 'Proyectos destacados',
      projectLiveLabel: 'Sitio en vivo',
      projectRepoLabel: 'Repositorio',
      projectCoverAlt: 'Captura de pantalla de',
      projectLastUpdatedLabel: 'Última actualización',
      projectsPageTitle: 'Proyectos — Carlos Rodríguez Huerta',
      projectsPageDescription:
        'Proyectos construidos por Carlos Rodríguez Huerta, desarrollador web full-stack.',
      projectsPageHeading: 'Proyectos',
      projectsBackLabel: 'Volver a proyectos',
      experienceHeading: 'Experiencia',
      experiencePageTitle: 'Experiencia — Carlos Rodríguez Huerta',
      experiencePageDescription:
        'Experiencia profesional de Carlos Rodríguez Huerta, desarrollador web full-stack.',
      experiencePageHeading: 'Experiencia',
      experienceSeeFullLabel: 'Ver experiencia completa',
      employmentTypeFullTime: 'Tiempo completo',
      employmentTypePartTime: 'Medio tiempo',
      employmentTypeFreelance: 'Freelance',
      employmentTypeContract: 'Contrato',
      skillsPageTitle: 'Habilidades — Carlos Rodríguez Huerta',
      skillsPageDescription:
        'Habilidades técnicas de Carlos Rodríguez Huerta, desarrollador web full-stack.',
      skillsPageHeading: 'Habilidades',
      skillCategoryFrontend: 'Frontend',
      skillCategoryBackend: 'Backend',
      skillCategoryData: 'Datos',
      skillCategoryDevops: 'DevOps',
      skillCategoryTesting: 'Testing',
      skillCategoryTools: 'Herramientas',
    });
  });
});
