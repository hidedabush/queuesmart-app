// Sample rows for a primary-care provider office that takes same-day walk-in
// visits. All names are fictional.
//
// - SEED_SERVICES: the five visit types. `npm run db:populate` adds them to
//   an empty MySQL database (src/database/mock/).
// - seedTables(): the in-memory tables every unit/API test starts from
//   (tests/fakes/db.js).

export const SEED_SERVICES = [
  {
    id: 's1',
    name: 'Sick Visit',
    description: 'Fever, cough, sore throat, ear pain, rashes, and other new symptoms.',
    expectedDuration: 15,
    priority: 'medium',
    capacity: 15,
    isOpen: true,
  },
  {
    id: 's2',
    name: 'Minor Injury',
    description: 'Sprains, small cuts, and minor burns that are not an emergency.',
    expectedDuration: 20,
    priority: 'high',
    capacity: 8,
    isOpen: true,
  },
  {
    id: 's3',
    name: 'Lab Work',
    description: 'Blood draws and specimen collection for tests your provider ordered.',
    expectedDuration: 10,
    priority: 'low',
    capacity: 20,
    isOpen: true,
  },
  {
    id: 's4',
    name: 'Vaccinations',
    description: 'Flu shots, boosters, and routine immunizations.',
    expectedDuration: 5,
    priority: 'low',
    capacity: 20,
    isOpen: true,
  },
  {
    id: 's5',
    name: 'Prescription Refill',
    description: 'A quick provider review to renew a medication you already take.',
    expectedDuration: 10,
    priority: 'low',
    capacity: 10,
    isOpen: false,
  },
];

// How many patients are already waiting in each line in the tests.
const WAITING = { s1: 6, s2: 2, s3: 4, s4: 3 };

// Finished visits on earlier days, so the statistics have something to read.
const SEED_HISTORY = [
  ['h1', 's4', 'Vaccinations', '2026-09-28', 'seen'],
  ['h2', 's1', 'Sick Visit', '2026-08-14', 'seen'],
  ['h3', 's3', 'Lab Work', '2026-07-02', 'cancelled'],
];

export function seedTables() {
  const lines = Object.entries(WAITING).flatMap(([serviceId, count]) =>
    Array.from({ length: count }, () => serviceId)
  );
  const startedAt = Date.now() - lines.length * 60_000;

  const queueEntries = lines.map((serviceId, index) => ({
    id: `q-seed-${index + 1}`,
    serviceId,
    status: 'waiting',
    priority: 'normal',
    order: index + 1,
    arrivedAt: startedAt + index * 60_000,
    calledAt: null,
    leftAt: null,
  }));

  const history = SEED_HISTORY.map(([id, serviceId, serviceName, date, outcome]) => {
    const leftAt = Date.parse(`${date}T15:00:00Z`);
    return {
      id,
      entryId: `q-${id}`,
      serviceId,
      serviceName,
      date,
      joinedAt: leftAt - 30 * 60_000,
      calledAt: outcome === 'seen' ? leftAt - 5 * 60_000 : null,
      leftAt,
      outcome,
    };
  });

  return {
    services: SEED_SERVICES.map((row) => ({ ...row })),
    queueEntries,
    history,
  };
}
