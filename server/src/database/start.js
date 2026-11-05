import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// npm run db:start: from nothing to a running database with the demo data.
//   1. creates server/.env from .env.example (with a random JWT_SECRET) if it
//      is missing
//   2. if DATABASE_URL is the Docker one, starts the MySQL container in
//      docker-compose.yml and waits until it accepts connections
//   3. creates any missing tables and the triggers, and adds the demo data
//      if the database is empty
// Safe to run every time: it keeps your .env, the container and your data.
// start-all.bat runs it before starting the server.

const SERVER = fileURLToPath(new URL('../../', import.meta.url));
const ENV_FILE = `${SERVER}.env`;
const EXAMPLE_FILE = `${SERVER}.env.example`;

// The MySQL in docker-compose.yml.
const DOCKER_URL = 'mysql://root:queuesmart@localhost:3306/queuesmart';

function ensureEnvFile() {
  if (existsSync(ENV_FILE)) {
    console.log('Using server/.env.');
    return;
  }
  const secret = randomBytes(32).toString('hex');
  const text = readFileSync(EXAMPLE_FILE, 'utf8').replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
  writeFileSync(ENV_FILE, text);
  console.log('Created server/.env from server/.env.example.');
}

function startDocker() {
  const info = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (info.error) {
    throw new Error(
      'Docker is not installed. Install Docker Desktop (https://www.docker.com/products/docker-desktop/), ' +
        'or install MySQL yourself: SETUP.md, "Manual setup".'
    );
  }
  if (info.status !== 0) {
    throw new Error('Docker is installed but not running. Open Docker Desktop, wait for "Engine running", then run this again.');
  }

  console.log('Starting MySQL in Docker (the first run downloads it, which takes a minute or two)...');
  const up = spawnSync('docker', ['compose', 'up', '-d', '--wait'], { cwd: SERVER, stdio: 'inherit' });
  if (up.status !== 0) {
    throw new Error(
      'Docker could not start MySQL (see above). If port 3306 is already in use, stop the other MySQL ' +
        '(for example a MySQL you installed yourself) and run this again.'
    );
  }
}

// The container reports healthy a moment before it takes logins from outside.
async function waitForDatabase(query) {
  for (let attempt = 1; ; attempt++) {
    try {
      await query('SELECT 1');
      return;
    } catch (error) {
      if (attempt === 20) throw new Error(`Can't reach the database at DATABASE_URL: ${error.message}`);
      await new Promise((done) => setTimeout(done, 1000));
    }
  }
}

async function main() {
  ensureEnvFile();
  process.loadEnvFile(ENV_FILE);

  if (process.env.DATABASE_URL === DOCKER_URL) {
    startDocker();
  } else {
    console.log('DATABASE_URL is not the Docker database, so Docker is skipped.');
  }

  // Imported only now: mysql.js reads DATABASE_URL as it loads.
  const { query, close } = await import('./mysql.js');
  const { counts, createTables, demoData, insertAll, isEmpty } = await import('./setup.js');

  try {
    await waitForDatabase(query);
    await createTables();
    console.log('Tables and triggers are ready.');

    if (await isEmpty()) {
      await insertAll(demoData());
      console.log('Added the demo data.');
    } else {
      console.log('The database already has data, so it was left as is.');
    }

    for (const [table, count] of Object.entries(await counts())) console.log(`  ${table}: ${count} rows`);
    console.log('\nThe database is ready. Start the server with: npm run dev');
  } finally {
    await close();
  }
}

try {
  await main();
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
