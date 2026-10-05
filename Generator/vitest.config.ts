import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The commander wiring is exercised by the CLI smoke test, not unit tests.
      exclude: ['src/cli/index.ts'],
      reporter: ['text', 'json-summary'],
      // Project spec section 15: 100% branch coverage for numeric/ and prng/.
      thresholds: {
        'src/numeric/**': { branches: 100, functions: 100, lines: 100, statements: 100 },
        'src/prng/**': { branches: 100, functions: 100, lines: 100, statements: 100 },
      },
    },
  },
});
