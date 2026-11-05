import { statsForDate, today } from '../api/services/statsService.js';
import { ensureServices, makeRandom, tick } from './mock/activity.js';
import { close } from './mysql.js';
import { createTables } from './setup.js';

// npm run db:live [-- --every 3 --ticks 50 --seed 7]
//
// Keeps the database moving like a real morning at the front desk: every
// few seconds a patient checks in, is called, is seen (or is a no-show) or
// cancels, stamped with the current time. The triggers check each step and
// write the history, so GET /stats and the admin dashboard change while you
// watch. Stop with Ctrl+C. --ticks stops by itself after that many events.

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
  served: 'seen in',
  'no-show': 'no-show for',
  canceled: 'cancelled',
  refused: 'REFUSED by the database for',
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
  await ensureServices();
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
