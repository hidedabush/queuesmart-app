import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { close } from './mysql.js';
import { counts, createTables, dropTables, runAll } from './setup.js';
import { splitSql } from './sqlFile.js';

// npm run db:migrate  creates any missing tables and (re)creates the
//                     triggers. Safe to run again; data is kept.
// npm run db:reset    DELETES these tables and all their data, then creates
//                     them again, EMPTY. Fill them with npm run db:populate.
// npm run db:load     REPLACES the tables with a dump (default
//                     src/database/dump.sql, or `-- path/to/file.sql`).

const args = process.argv.slice(2);
const DEFAULT_DUMP = new URL('./dump.sql', import.meta.url);

// Aiven (and any MySQL with binary logging) refuses CREATE TRIGGER from a
// user without SUPER unless log_bin_trust_function_creators is on.
const TRIGGER_PRIVILEGE = 'ER_BINLOG_CREATE_ROUTINE_NEED_SUPER';

try {
  if (args.includes('--load')) {
    const file = args.find((arg) => !arg.startsWith('--'));
    const path = file ? resolve(file) : DEFAULT_DUMP;
    await runAll(splitSql(readFileSync(path, 'utf8')));
    console.log(`Loaded ${file ?? 'src/database/dump.sql'}.`);
  } else {
    if (args.includes('--reset')) {
      await dropTables();
      console.log('Dropped the tables.');
    }
    await createTables();
    console.log('Tables and triggers are ready.');
  }

  for (const [table, count] of Object.entries(await counts())) console.log(`  ${table}: ${count} rows`);
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
