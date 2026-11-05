import { defineConfig } from 'vitest/config';

// npm run test:mysql: checks the real repositories against DATABASE_URL.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/mysql/**/*.test.js'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
