import { ensureServices, fillToday, makeRandom } from './mock/activity.js';
import { close } from './mysql.js';
import { counts, createTables } from './setup.js';

// npm run db:populate [-- --seed 42]
//
// Adds sample data on top of whatever is there, so an empty database fills
// up as you go: the five sample visit types (only the missing ones), then
// for every open line a few visits that already ended today and a few
// patients still waiting. All times are relative to now, so the admin
// dashboard's "today" always has numbers. Run it again to add more.

const args = process.argv.slice(2);
const seedArg = args.indexOf('--seed');
const seed = seedArg >= 0 ? Number(args[seedArg + 1]) : Date.now();

try {
  await createTables();

  const added = await ensureServices();
  console.log(added.length ? `Added visit types: ${added.map((s) => s.name).join(', ')}` : 'Visit types already there.');

  const summary = await fillToday({ random: makeRandom(seed) });
  console.log(`Played ${summary.finished} visits that ended today, and ${summary.waiting} patients are now waiting.`);
  for (const { service, code, message } of summary.refused) {
    console.log(`  refused by the database (${service}): ${code} - ${message}`);
  }

  for (const [table, count] of Object.entries(await counts())) console.log(`  ${table}: ${count} rows`);
  console.log(`(seed ${seed}; pass --seed ${seed} to repeat this run on an empty database)`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}
