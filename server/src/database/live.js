import { statsForDate, today } from '../api/services/statsService.js';
import { makeRandom, tick } from './mock/activity.js';
import { close } from './mysql.js';
import { createTables, demoData, insertAll, isEmpty } from './setup.js';

// npm run db:live [-- --every 3 --ticks 50 --seed 7]
//
// Keeps the database moving like a real morning at the front desk: every
// few seconds a patient checks in, is called, is seen (or is a no-show) or
// cancels, through the app's own queue services, so history and notices
// are written as for a real patient and the triggers check every step.
// GET /stats, the admin dashboard and the front desk change while you
// watch. An empty database gets the demo data first. Stop with Ctrl+C;
// --ticks stops by itself after that many events.

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};

const everyMs = option('every', 3) * 1000;
const ticks = option('ticks', Infinity);
const random = makeRandom(option('seed', Date.now()));

const LABELS = {
  joined: 'checked in to',
  called: 'called for',
  seen: 'seen in',
  'no-show': 'no-show for',
  cancelled: 'cancelled',
  refused: 'REFUSED for',
  idle: 'no visit types yet',
};

async function printStats() {
  const { date, services } = await statsForDate(today());
  console.log(`\n  Today (${date}, UTC)       waiting  served  no-show  cancelled  avg wait`);
  for (const s of services) {
    const wait = s.averageWaitMinutes === null ? '-' : `${s.averageWaitMinutes} min`;
    console.log(
      `  ${s.name.padEnd(24)} ${String(s.currentlyWaiting).padStart(7)} ${String(s.served).padStart(7)}` +
        ` ${String(s.noShows).padStart(8)} ${String(s.cancelled).padStart(10)}  ${wait.padStart(8)}`
    );
  }
  console.log('');
}

let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
});

try {
  await createTables();
  if (await isEmpty()) await insertAll(demoData());
  console.log(`Live mock data: one event every ${everyMs / 1000}s. Ctrl+C to stop.`);

  for (let count = 1; count <= ticks && !stopping; count += 1) {
    const event = await tick({ random });
    const time = new Date().toLocaleTimeString();
    const detail = event.type === 'refused' ? ` (${event.code}: ${event.message})` : '';
    console.log(`${time}  ${LABELS[event.type]} ${event.service ?? ''}${detail}`);

    if (count % 10 === 0) await printStats();
    if (count < ticks && !stopping) await new Promise((done) => setTimeout(done, everyMs));
  }
  await printStats();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await close();
}
