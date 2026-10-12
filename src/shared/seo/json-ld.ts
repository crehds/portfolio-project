// Pure domain logic: no Astro imports (so Vitest exercises this without Astro).

/** What the site says about its owner to a crawler: the facts of the profile, as given. */
export interface PersonInput {
  name: string;
  /** What the person does, in the page's language. */
  jobTitle: string;
  description: string;
  /** The page's own canonical address, absolute. */
  url: string;
  /** The profile photo, absolute. */
  image: string;
  /** The person's profiles elsewhere (LinkedIn, GitHub), absolute. */
  sameAs: readonly string[];
}

/** A schema.org `Person`, as plain data (https://schema.org/Person). */
export interface PersonJsonLd extends Omit<PersonInput, 'sameAs'> {
  '@context': 'https://schema.org';
  '@type': 'Person';
  sameAs: string[];
}

function assertAbsolute(address: string, field: string): void {
  if (!URL.canParse(address)) {
    throw new Error(
      `The ${field} of the person must be absolute, and "${address}" is not.`,
    );
  }
}

/**
 * The structured data of the home page: a schema.org `Person`, made of the facts it is given
 * and nothing else, so it cannot say what the page does not. Crawlers resolve nothing against
 * the page, so every address must be absolute, and a relative one stops the build here.
 */
export function buildPersonJsonLd(person: PersonInput): PersonJsonLd {
  assertAbsolute(person.url, 'url');
  assertAbsolute(person.image, 'image');
  for (const profile of person.sameAs) {
    assertAbsolute(profile, 'sameAs');
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    jobTitle: person.jobTitle,
    description: person.description,
    url: person.url,
    image: person.image,
    sameAs: [...person.sameAs],
  };
}

/**
 * Writes structured data to go inside a `<script type="application/ld+json">`. The content of
 * a script is not escaped like text, and `</script>` in it ends the element, so every `<` is
 * written as `<`: JSON reads it back as the same character, and the markup never sees one.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
