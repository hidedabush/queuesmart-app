import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      // index.js only starts the listener; seed.js is data, not logic.
      exclude: ['src/index.js', 'src/database/seed.js'],
      reporter: ['text', 'html'],
      // Brief target is 70-80%. The run fails if coverage drops below this.
      thresholds: { lines: 75, functions: 75, branches: 75, statements: 75 },
    },
  },
});
