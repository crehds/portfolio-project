// Pure domain logic: no Astro/Zod imports.
import type { Locale } from './locales';

/**
 * The site's UI dictionary (port): English is the reference shape, so `UiDictionary` is
 * derived from it below and the Spanish dictionary fails typecheck if a key is missing or
 * added without a translation. Keep this minimal: only what T05 renders. Language names are
 * endonyms (see `locale-names.ts`) and never go through this dictionary.
 */
const en = {
  siteTitle: 'Carlos Rodríguez Huerta',
  siteDescription:
    'Portfolio of Carlos Rodríguez Huerta, full-stack web developer. Rebuild in progress.',
  rebuildNotice: 'Portfolio rebuild in progress.',
  languageSwitcherLabel: 'Language switcher',
  themeToggleLabel: 'Toggle color theme',
  skipLinkLabel: 'Skip to main content',
  linkOpensInNewTab: '(opens in a new tab)',
  primaryNavLabel: 'Primary navigation',
  navHome: 'Home',
  navProjects: 'Projects',
  navExperience: 'Experience',
  navSkills: 'Skills',
  navContact: 'Contact',
  footerGithubLabel: 'GitHub',
  footerLinkedinLabel: 'LinkedIn',
  footerEmailLabel: 'Email',
  heroPhotoAlt: 'Portrait of',
  ctaFormLabel: 'Send a message',
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
  contactPageTitle: 'Contact — Carlos Rodríguez Huerta',
  contactPageDescription:
    'Get in touch with Carlos Rodríguez Huerta, full-stack web developer: a contact form, email and WhatsApp.',
  contactPageHeading: 'Contact',
  contactOtherWaysHeading: 'Other ways to reach me',
};

export type UiDictionary = typeof en;

const es: UiDictionary = {
  siteTitle: 'Carlos Rodríguez Huerta',
  siteDescription:
    'Portafolio de Carlos Rodríguez Huerta, desarrollador web full-stack. Reconstrucción en curso.',
  rebuildNotice: 'Portafolio en reconstrucción.',
  languageSwitcherLabel: 'Selector de idioma',
  themeToggleLabel: 'Cambiar tema de color',
  skipLinkLabel: 'Saltar al contenido principal',
  linkOpensInNewTab: '(se abre en una pestaña nueva)',
  primaryNavLabel: 'Navegación principal',
  navHome: 'Inicio',
  navProjects: 'Proyectos',
  navExperience: 'Experiencia',
  navSkills: 'Habilidades',
  navContact: 'Contacto',
  footerGithubLabel: 'GitHub',
  footerLinkedinLabel: 'LinkedIn',
  footerEmailLabel: 'Correo electrónico',
  heroPhotoAlt: 'Retrato de',
  ctaFormLabel: 'Enviar un mensaje',
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
  contactPageTitle: 'Contacto — Carlos Rodríguez Huerta',
  contactPageDescription:
    'Ponte en contacto con Carlos Rodríguez Huerta, desarrollador web full-stack: formulario de contacto, correo electrónico y WhatsApp.',
  contactPageHeading: 'Contacto',
  contactOtherWaysHeading: 'Otras formas de contactarme',
};

const dictionaries: Record<Locale, UiDictionary> = { en, es };

/** Looks up the UI dictionary for a locale. */
export function getDictionary(locale: Locale): UiDictionary {
  return dictionaries[locale];
}
