import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fakes = fileURLToPath(new URL('./tests/fakes/repositories/', import.meta.url));

export default defineConfig({
  resolve: {
    // Tests never touch a MySQL database. The services (and the mock-data
    // engine in src/database/mock/) import their repositories as
    // '../../database/repositories/xRepo.js', and only those imports get the
    // in-memory stand-ins. A test that imports a real
    // repository by its own path ('../../src/database/...') still gets it:
    // tests/unit/repositories.test.js with a mocked connection, and
    // tests/mysql/ against a real database (vitest.mysql.config.js).
    alias: [
      {
        find: /^\.\.\/\.\.\/database\/repositories\/(\w+Repo\.js)$/,
        replacement: `${fakes}$1`,
      },
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.js'],
    exclude: ['**/node_modules/**', 'tests/mysql/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      // index.js only starts the listener; migrate, populate, live and dump
      // only read the command line and print (their logic is in setup.js,
      // mock/activity.js and dumpSql.js); start.js only runs Docker and
      // migrate for npm run db:start; seed.js is data, not logic.
      exclude: [
        'src/index.js',
        'src/database/start.js',
        'src/database/migrate.js',
        'src/database/populate.js',
        'src/database/live.js',
        'src/database/dump.js',
        'src/database/seed.js',
      ],
      reporter: ['text', 'html'],
      // Brief target is 70-80%. The run fails if coverage drops below this.
      thresholds: { lines: 75, functions: 75, branches: 75, statements: 75 },
    },
  },
});
