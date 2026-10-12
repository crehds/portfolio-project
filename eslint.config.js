import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginAstro from 'eslint-plugin-astro';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig([
  globalIgnores([
    'dist/**',
    '.astro/**',
    'node_modules/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '.wrangler/**',
    'worker-configuration.d.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginAstro.configs.recommended,
  eslintPluginAstro.configs['jsx-a11y-strict'],
  eslintConfigPrettier,
  {
    // Manual generator scripts (scripts/): Node programs that log what they write, and one
    // runs in the page it drives, so `console` and `document` are theirs to use.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', document: 'readonly' },
    },
  },
  {
    // Node-only config file: it branches on process.env.VITEST, unlike the browser-facing
    // site code, so it alone needs the Node `process` global.
    files: ['astro.config.mjs'],
    languageOptions: {
      globals: { process: 'readonly' },
    },
  },
]);
