import { describe, expect, it } from 'vitest';

import { whatsappLink } from './whatsapp-link';

describe('whatsappLink', () => {
  it('strips the leading "+" from an E.164 number', () => {
    expect(whatsappLink('+51970791041')).toBe('https://wa.me/51970791041');
  });

  it('strips any other non-digit characters defensively', () => {
    expect(whatsappLink('+1 (555) 123-4567')).toBe('https://wa.me/15551234567');
  });
});
