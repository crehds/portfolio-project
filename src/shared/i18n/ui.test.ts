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
      contactLead:
        'Send me a message with this form, or reach me directly by email or WhatsApp. I will reply to the address you give me.',
      contactOtherWaysHeading: 'Other ways to reach me',
      contactFormNameLabel: 'Name',
      contactFormEmailLabel: 'Email address',
      contactFormMessageLabel: 'Message',
      contactFormSubmit: 'Send message',
      contactErrorPrefix: 'Error:',
      contactErrorSummaryHeading: 'There is a problem with the form',
      contactErrorNameRequired: 'Enter your name.',
      contactErrorNameTooLong: 'Your name must be {limit} characters or fewer.',
      contactErrorNameInvalid:
        'Your name cannot contain line breaks or other control characters.',
      contactErrorEmailRequired: 'Enter your email address.',
      contactErrorEmailInvalid:
        'Enter a valid email address, like name@example.com.',
      contactErrorEmailTooLong:
        'Your email address must be {limit} characters or fewer.',
      contactErrorMessageRequired: 'Enter a message.',
      contactErrorMessageTooLong:
        'Your message must be {limit} characters or fewer.',
      contactErrorInvalidValue: 'This value cannot be used.',
      contactSentMessage:
        'Your message was sent. Thank you! I will reply to the address you gave me as soon as I can.',
      contactSentAnother: 'Send another message',
      contactHoneypotLabel: 'Leave this field empty',
      contactAlertVerificationFailed:
        'The spam check did not pass, so your message was not sent. Please try again, or write to me by email or WhatsApp.',
      contactAlertRateLimited:
        'You have sent several messages in a short time, so this one was not sent. Please wait a minute and try again, or write to me by email or WhatsApp.',
      contactAlertInvalidRequest:
        'The form could not be processed, so your message was not sent. Please try again, or write to me by email or WhatsApp.',
      contactAlertTooLarge:
        'Your message is too large to send, so it was not sent. Please shorten it, or write to me by email or WhatsApp.',
      contactFallbackHeading: 'The form is not available right now',
      contactFallbackBody: 'Please write to me by email or WhatsApp instead.',
      contactFallbackBodyKept:
        'Your message was not sent. Please write to me by email or WhatsApp instead; your message is below so you can copy it.',
      contactFallbackMessageLabel: 'Your message, to copy',
      contactNoJsHeading: 'The form needs JavaScript',
      contactNoJsBody:
        'The contact form runs a spam check that needs JavaScript, which is off or blocked in your browser. Please write to me by email or WhatsApp instead.',
      notFoundPageTitle: 'Page not found — Carlos Rodríguez Huerta',
      notFoundPageDescription:
        'This page does not exist on the portfolio of Carlos Rodríguez Huerta.',
      notFoundPageHeading: 'Page not found',
      notFoundMessage:
        'The page you are looking for does not exist or has moved.',
      notFoundHomeLabel: 'Go to the home page',
      notFoundProjectsLabel: 'See the projects',
    });
  });

  it('returns the expected spanish strings', () => {
    expect(getDictionary('es')).toEqual({
      siteTitle: 'Carlos Rodríguez Huerta',
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
      contactLead:
        'Envíame un mensaje con este formulario, o escríbeme directamente por correo electrónico o WhatsApp. Responderé a la dirección que me indiques.',
      contactOtherWaysHeading: 'Otras formas de contactarme',
      contactFormNameLabel: 'Nombre',
      contactFormEmailLabel: 'Correo electrónico',
      contactFormMessageLabel: 'Mensaje',
      contactFormSubmit: 'Enviar mensaje',
      contactErrorPrefix: 'Error:',
      contactErrorSummaryHeading: 'Hay un problema con el formulario',
      contactErrorNameRequired: 'Escribe tu nombre.',
      contactErrorNameTooLong:
        'Tu nombre debe tener {limit} caracteres o menos.',
      contactErrorNameInvalid:
        'Tu nombre no puede contener saltos de línea ni otros caracteres de control.',
      contactErrorEmailRequired: 'Escribe tu correo electrónico.',
      contactErrorEmailInvalid:
        'Escribe un correo electrónico válido, como nombre@ejemplo.com.',
      contactErrorEmailTooLong:
        'Tu correo electrónico debe tener {limit} caracteres o menos.',
      contactErrorMessageRequired: 'Escribe un mensaje.',
      contactErrorMessageTooLong:
        'Tu mensaje debe tener {limit} caracteres o menos.',
      contactErrorInvalidValue: 'Este valor no se puede usar.',
      contactSentMessage:
        'Tu mensaje fue enviado. ¡Gracias! Te responderé a la dirección que me indicaste lo antes posible.',
      contactSentAnother: 'Enviar otro mensaje',
      contactHoneypotLabel: 'Deja este campo vacío',
      contactAlertVerificationFailed:
        'La verificación contra spam no se superó, así que tu mensaje no se envió. Inténtalo de nuevo, o escríbeme por correo electrónico o WhatsApp.',
      contactAlertRateLimited:
        'Has enviado varios mensajes en poco tiempo, así que este no se envió. Espera un minuto e inténtalo de nuevo, o escríbeme por correo electrónico o WhatsApp.',
      contactAlertInvalidRequest:
        'No se pudo procesar el formulario, así que tu mensaje no se envió. Inténtalo de nuevo, o escríbeme por correo electrónico o WhatsApp.',
      contactAlertTooLarge:
        'Tu mensaje es demasiado grande para enviarlo, así que no se envió. Acórtalo, o escríbeme por correo electrónico o WhatsApp.',
      contactFallbackHeading: 'El formulario no está disponible por ahora',
      contactFallbackBody:
        'Por favor, escríbeme por correo electrónico o WhatsApp.',
      contactFallbackBodyKept:
        'Tu mensaje no se envió. Por favor, escríbeme por correo electrónico o WhatsApp; tu mensaje está abajo para que puedas copiarlo.',
      contactFallbackMessageLabel: 'Tu mensaje, para copiarlo',
      contactNoJsHeading: 'El formulario necesita JavaScript',
      contactNoJsBody:
        'El formulario de contacto hace una verificación contra spam que necesita JavaScript, y tu navegador lo tiene desactivado o bloqueado. Por favor, escríbeme por correo electrónico o WhatsApp.',
      notFoundPageTitle: 'Página no encontrada — Carlos Rodríguez Huerta',
      notFoundPageDescription:
        'Esta página no existe en el portafolio de Carlos Rodríguez Huerta.',
      notFoundPageHeading: 'Página no encontrada',
      notFoundMessage: 'La página que buscas no existe o fue movida.',
      notFoundHomeLabel: 'Ir al inicio',
      notFoundProjectsLabel: 'Ver los proyectos',
    });
  });
});
