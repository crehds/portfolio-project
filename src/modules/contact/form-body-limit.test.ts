import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { MAX_TOKEN_LENGTH } from './adapters/turnstile-verifier';
import {
  ACTION_BODY_LIMIT_BYTES,
  largestFormBodyBytes,
} from './form-body-limit';
import { CONTACT_LIMITS } from './schema';

// `security.actionBodySizeLimit` is the most bytes Astro reads from the body of a request to
// an Action; past it the request is refused before it is parsed (a 413). It has to leave
// room for the largest submission the form can legitimately send, and stay small enough to
// be a limit at all. These tests tie it to the schema's own limits, so that raising a field's
// limit without raising this one fails here and not on a visitor's first long message.

describe('largestFormBodyBytes', () => {
  // A hand-computed oracle. Every field is `name=value`, joined with `&`: name (4 + 1 + 9),
  // email (5 + 1 + 3), message (7 + 1 + 9), website (7 + 1 + 0), the token (21 + 1 + 3) and
  // the locale (6 + 1 + 2), plus the five `&` between them.
  it('adds up every field of the form, one unit of each limit', () => {
    expect(largestFormBodyBytes({ name: 1, email: 1, message: 1 }, 1)).toBe(
      14 + 9 + 17 + 8 + 25 + 9 + 5,
    );
  });

  it('costs nine bytes per unit of the name and of the message: a three-byte character, written %XX%XX%XX', () => {
    const base = largestFormBodyBytes({ name: 10, email: 10, message: 10 }, 10);

    expect(largestFormBodyBytes({ name: 11, email: 10, message: 10 }, 10)).toBe(
      base + 9,
    );
    expect(largestFormBodyBytes({ name: 10, email: 10, message: 11 }, 10)).toBe(
      base + 9,
    );
  });

  it('costs three bytes per character of the email and of the token: ASCII, at worst written %XX', () => {
    const base = largestFormBodyBytes({ name: 10, email: 10, message: 10 }, 10);

    expect(largestFormBodyBytes({ name: 10, email: 11, message: 10 }, 10)).toBe(
      base + 3,
    );
    expect(largestFormBodyBytes({ name: 10, email: 10, message: 10 }, 11)).toBe(
      base + 3,
    );
  });

  it('is about 52 KB for the limits the form really has', () => {
    // 100 + 254 + 5,000 units and a token of 2,048: the message alone is 45,000 bytes.
    expect(largestFormBodyBytes(CONTACT_LIMITS, MAX_TOKEN_LENGTH)).toBe(52_869);
  });
});

describe('ACTION_BODY_LIMIT_BYTES', () => {
  it('is 64 KiB', () => {
    expect(ACTION_BODY_LIMIT_BYTES).toBe(65_536);
  });

  it('leaves room for the largest submission the form can send, every field at its limit', () => {
    const largest = largestFormBodyBytes(CONTACT_LIMITS, MAX_TOKEN_LENGTH);

    expect(largest).toBeLessThanOrEqual(ACTION_BODY_LIMIT_BYTES);
  });

  it('is more than the old 32 KiB, which a message in Cyrillic, Greek, Arabic or Hebrew at full length already passed', () => {
    // Two bytes a character, six once written %XX%XX: 5,000 units are 30,000 bytes, and the
    // name, the email, the token and the field names bring a full submission past 32,768.
    const twoByteScript = 5_000 * 6 + 100 * 6 + 254 + 2_048 + 100;

    expect(twoByteScript).toBeGreaterThan(32 * 1024);
    expect(twoByteScript).toBeLessThanOrEqual(ACTION_BODY_LIMIT_BYTES);
  });

  it('stays a limit: not more than twice the largest submission, nowhere near Astro’s default of 1 MiB', () => {
    const largest = largestFormBodyBytes(CONTACT_LIMITS, MAX_TOKEN_LENGTH);

    expect(ACTION_BODY_LIMIT_BYTES).toBeLessThanOrEqual(2 * largest);
    expect(ACTION_BODY_LIMIT_BYTES).toBeLessThan(1024 * 1024);
  });

  it('is the number astro.config.mjs hands to Astro, not a copy of it', () => {
    const config = readFileSync(
      new URL('../../../astro.config.mjs', import.meta.url),
      'utf8',
    );

    expect(config).toMatch(
      /import\s*\{\s*ACTION_BODY_LIMIT_BYTES\s*\}\s*from\s*'\.\/src\/modules\/contact\/form-body-limit\.ts'/,
    );
    expect(config).toMatch(/actionBodySizeLimit:\s*ACTION_BODY_LIMIT_BYTES\b/);
  });
});
