import { close } from './mysql.js';
import { sampleTables, seedTables } from './seed.js';
import { createTables, dropTables, insertAll, isEmpty } from './setup.js';

// npm run db:migrate  creates any missing tables (safe to run again).
// npm run db:seed     also adds the demo data, but only to an empty database,
//                     because everyone on the team shares it.
// npm run db:reset    DELETES every table and all data, then rebuilds and
//                     reseeds. Use it after a schema change.

const args = process.argv.slice(2);

function demoData() {
  const base = seedTables();
  const sample = sampleTables();
  return {
    ...base,
    users: [...base.users, ...sample.users],
    queueEntries: [...base.queueEntries, ...sample.queueEntries],
    history: [...base.history, ...sample.history],
  };
}

try {
  if (args.includes('--reset')) {
    await dropTables();
    console.log('Dropped every table.');
  }

  await createTables();
  console.log('Tables are ready.');

  if (args.includes('--seed')) {
    if (!(await isEmpty())) {
      throw new Error('The database already has data, so the demo data was not added. Use npm run db:reset to start over.');
    }
    const counts = await insertAll(demoData());
    for (const [table, count] of Object.entries(counts)) console.log(`  ${table}: ${count} rows`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}
