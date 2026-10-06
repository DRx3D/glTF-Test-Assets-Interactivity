import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const ENGINE = '@khronosgroup/gltf-interactivity-engine';

export default defineConfig({
  plugins: [
    {
      // The engine's build names source maps it does not ship; drop the comments so Vite
      // does not warn about every file.
      name: 'strip-engine-source-map-comments',
      load(id) {
        if (!id.replaceAll('\\', '/').includes(`/node_modules/${ENGINE}/`)) return null;
        return readFileSync(id.split('?')[0] ?? id, 'utf8').replace(/^\/\/# sourceMappingURL=.*$/gm, '');
      },
    },
  ],
  test: {
    include: ['test/**/*.test.ts'],
    // The authoring tool's engine ships ESM with extensionless imports; Vite resolves them
    // when the package is inlined (src/adapters/authoringEngine.ts).
    server: { deps: { inline: [ENGINE] } },
    // End-to-end generation (golden and engine tests) takes a few seconds.
    testTimeout: 60000,
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
