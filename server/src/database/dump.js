import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDump, readTables } from './dumpSql.js';
import { close } from './mysql.js';

// npm run db:dump [-- path/to/file.sql]
//
// Writes the whole database (tables, rows and triggers) to one .sql file,
// src/database/dump.sql unless a path is given. No mysqldump needed.
// npm run db:load puts it back.

const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const path = file ? resolve(file) : fileURLToPath(new URL('./dump.sql', import.meta.url));

try {
  const tables = await readTables();
  writeFileSync(path, buildDump(tables));
  console.log(`Wrote ${path}`);
  for (const [table, rows] of Object.entries(tables)) console.log(`  ${table}: ${rows.length} rows`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}
