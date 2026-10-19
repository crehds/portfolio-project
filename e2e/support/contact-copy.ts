// The words of the contact page in both locales, as the specs expect to read them. They are
// spelled out here, not imported from the site's dictionary, so that a change to the wording
// is a change to the tests too (src/shared/i18n/ui.test.ts pins the dictionary the same way).
export interface ContactCopy {
  lang: 'en' | 'es';
  path: string;
  sentPath: string;
  title: string;
  name: string;
  email: string;
  message: string;
  submit: string;
  sent: string;
  another: string;
  summary: string;
  errorWord: string;
  nameRequired: string;
  emailRequired: string;
  emailInvalid: string;
  messageRequired: string;
  alertVerification: string;
  alertRateLimited: string;
  fallbackHeading: string;
  fallbackKept: string;
  fallbackMessageLabel: string;
  emailLink: string;
  whatsappLink: string;
}

export const COPY: ContactCopy[] = [
  {
    lang: 'en',
    path: '/contact/',
    sentPath: '/contact/?sent=1',
    title: 'Contact — Carlos Rodríguez Huerta',
    name: 'Name',
    email: 'Email address',
    message: 'Message',
    submit: 'Send message',
    sent: 'Your message was sent. Thank you!',
    another: 'Send another message',
    summary: 'There is a problem with the form',
    errorWord: 'Error:',
    nameRequired: 'Enter your name.',
    emailRequired: 'Enter your email address.',
    emailInvalid: 'Enter a valid email address, like name@example.com.',
    messageRequired: 'Enter a message.',
    alertVerification:
      'The spam check did not pass, so your message was not sent.',
    alertRateLimited:
      'You have sent several messages in a short time, so this one was not sent.',
    fallbackHeading: 'The form is not available right now',
    fallbackKept: 'Your message was not sent.',
    fallbackMessageLabel: 'Your message, to copy',
    emailLink: 'Email',
    whatsappLink: 'WhatsApp',
  },
  {
    lang: 'es',
    path: '/es/contact/',
    sentPath: '/es/contact/?sent=1',
    title: 'Contacto — Carlos Rodríguez Huerta',
    name: 'Nombre',
    email: 'Correo electrónico',
    message: 'Mensaje',
    submit: 'Enviar mensaje',
    sent: 'Tu mensaje fue enviado. ¡Gracias!',
    another: 'Enviar otro mensaje',
    summary: 'Hay un problema con el formulario',
    errorWord: 'Error:',
    nameRequired: 'Escribe tu nombre.',
    emailRequired: 'Escribe tu correo electrónico.',
    emailInvalid:
      'Escribe un correo electrónico válido, como nombre@ejemplo.com.',
    messageRequired: 'Escribe un mensaje.',
    alertVerification:
      'La verificación contra spam no se superó, así que tu mensaje no se envió.',
    alertRateLimited:
      'Has enviado varios mensajes en poco tiempo, así que este no se envió.',
    fallbackHeading: 'El formulario no está disponible por ahora',
    fallbackKept: 'Tu mensaje no se envió.',
    fallbackMessageLabel: 'Tu mensaje, para copiarlo',
    emailLink: 'Correo electrónico',
    whatsappLink: 'WhatsApp',
  },
];
