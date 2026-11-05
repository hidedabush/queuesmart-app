import * as servicesRepo from './repositories/servicesRepo.js';
import { addWaiting, makeRandom, pastVisits } from './mock/activity.js';
import { close } from './mysql.js';
import { counts, createTables, demoData, insertAll, isEmpty } from './setup.js';

// npm run db:populate [-- --seed 42]
//
// Adds sample data on top of whatever is there, so a database that starts
// empty (npm run db:empty) fills up as you go:
//   - an empty database first gets the demo data (npm run db:seed): the
//     admin and demo patient accounts, the 5 visit types, people waiting
//   - every run then adds, on each open line, a few visits that already
//     ended today (with their history and notices) and a few patients
//     checking in now, through the app's own check-in
// All times are relative to now, so "today" on the admin dashboard always
// has numbers. Run it again to add more.

const args = process.argv.slice(2);
const seedArg = args.indexOf('--seed');
const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : Date.now();
const random = makeRandom(seed);

try {
  await createTables();

  if (await isEmpty()) {
    await insertAll(demoData());
    console.log('The database was empty, so the demo data (npm run db:seed) went in first.');
  }

  const past = pastVisits({ services: await servicesRepo.list(), random });
  await insertAll(past);
  console.log(`Added ${past.history.length} visits that ended today.`);

  const now = await addWaiting({ random });
  console.log(`${now.waiting} new patients checked in.`);
  for (const { service, code, message } of now.refused) {
    console.log(`  refused (${service}): ${code} - ${message}`);
  }

  for (const [table, count] of Object.entries(await counts())) console.log(`  ${table}: ${count} rows`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}
