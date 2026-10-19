// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- required by Vitest to type the `test` config key
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';
import { configDefaults } from 'vitest/config';

export default getViteConfig({
  test: {
    // Playwright owns everything under e2e/; keep Vitest from trying to run those specs.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
