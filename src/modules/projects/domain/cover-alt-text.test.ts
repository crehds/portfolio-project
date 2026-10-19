import { describe, expect, it } from 'vitest';

import { coverAltText } from './cover-alt-text';

describe('coverAltText', () => {
  it('reads "Screenshot of" and the project title in English', () => {
    expect(coverAltText('Pysa', 'en')).toBe('Screenshot of Pysa');
    expect(coverAltText('Game with keyboard', 'en')).toBe(
      'Screenshot of Game with keyboard',
    );
  });

  it('reads "Captura de pantalla de" and the project title in Spanish', () => {
    expect(coverAltText('Pysa Gaming', 'es')).toBe(
      'Captura de pantalla de Pysa Gaming',
    );
    expect(coverAltText('Juego con teclado', 'es')).toBe(
      'Captura de pantalla de Juego con teclado',
    );
  });

  it('puts the title it is given after the label, as it is', () => {
    // A project's title differs by locale, and the caller passes the one it shows; the text
    // is not trimmed, quoted or escaped here (writing it into an attribute escapes it).
    expect(coverAltText('Fish & "chips" <b>', 'en')).toBe(
      'Screenshot of Fish & "chips" <b>',
    );
    expect(coverAltText('Expresión Latina', 'es')).toBe(
      'Captura de pantalla de Expresión Latina',
    );
  });
});
