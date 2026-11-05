import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { close } from './mysql.js';
import { counts, createTables, demoData, dropTables, insertAll, isEmpty, runAll } from './setup.js';
import { splitSql } from './sqlFile.js';

// npm run db:migrate  creates any missing tables and (re)creates the
//                     triggers (safe to run again).
// npm run db:seed     also adds the demo data, but only to an empty database,
//                     because everyone on the team shares it.
// npm run db:reset    DELETES every table and all data, then rebuilds and
//                     reseeds. Use it after a schema change.
// npm run db:empty    DELETES every table and all data, then rebuilds them
//                     EMPTY. Fill them with npm run db:populate.
// npm run db:load     REPLACES every table with a dump (default
//                     src/database/dump.sql, or `-- path/to/file.sql`).

const args = process.argv.slice(2);
const DEFAULT_DUMP = new URL('./dump.sql', import.meta.url);

// Aiven (and any MySQL with binary logging) refuses CREATE TRIGGER from a
// user without SUPER unless log_bin_trust_function_creators is on.
const TRIGGER_PRIVILEGE = 'ER_BINLOG_CREATE_ROUTINE_NEED_SUPER';

async function main() {
  if (args.includes('--load')) {
    const file = args.find((arg) => !arg.startsWith('--'));
    await runAll(splitSql(readFileSync(file ? resolve(file) : DEFAULT_DUMP, 'utf8')));
    console.log(`Loaded ${file ?? 'src/database/dump.sql'}.`);
  } else {
    if (args.includes('--reset')) {
      await dropTables();
      console.log('Dropped every table.');
    }

    await createTables();
    console.log('Tables and triggers are ready.');

    if (args.includes('--seed')) {
      if (!(await isEmpty())) {
        throw new Error('The database already has data, so the demo data was not added. Use npm run db:reset to start over.');
      }
      await insertAll(demoData());
    }
  }

  for (const [table, count] of Object.entries(await counts())) console.log(`  ${table}: ${count} rows`);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  if (error.code === TRIGGER_PRIVILEGE) {
    console.error(
      'This MySQL user may not create triggers while binary logging is on. Turn on the ' +
        'server setting log_bin_trust_function_creators (or use a user with SUPER), then run this again.'
    );
  }
  process.exitCode = 1;
} finally {
  await close();
}
