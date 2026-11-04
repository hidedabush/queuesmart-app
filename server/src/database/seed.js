// Starting rows for the database (see migrate.js and the test fakes): a primary-care provider office
// that takes same-day walk-in visits. All names are fictional.

import { scryptSync } from 'node:crypto';

const SEED_SERVICES = [
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

// Demo-only password hashes. Real accounts get a random salt at registration.
function seedPasswordHash(password, salt) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

const SEED_USERS = [
  {
    id: 'u-admin',
    name: 'QueueSmart Admin',
    dob: '1980-01-01',
    email: 'admin@queuesmart.test',
    phone: null,
    passwordHash: seedPasswordHash('Admin#2026', 'queuesmart-admin-seed'),
    role: 'admin',
  },
  {
    id: 'u-patient',
    name: 'Demo Patient',
    dob: '1995-03-14',
    email: 'patient@queuesmart.test',
    phone: '7135550101',
    passwordHash: seedPasswordHash('Patient#2026', 'queuesmart-patient-seed'),
    role: 'user',
  },
];

// Everyone already in line when the server starts, so the front desk board
// has real waiting counts. The users table (and the patient's name, date of
// birth and login) belongs to the auth teammate; until then each entry only
// keeps a userId placeholder.
const waitingRoom = [
  ['s1', 'Fever and sore throat since Tuesday'],
  ['s1', 'Ear pain, left side'],
  ['s1', 'Cough for about a week'],
  ['s1', 'Itchy rash on forearm'],
  ['s1', 'Sinus pressure and headache'],
  ['s1', 'Stomach pain since last night'],
  ['s2', 'Twisted ankle at soccer practice'],
  ['s2', 'Small cut on finger, needs a look'],
  ['s3', 'Fasting blood work for annual physical'],
  ['s3', 'Cholesterol panel'],
  ['s3', 'A1C check'],
  ['s3', 'Thyroid panel'],
  ['s4', 'Flu shot'],
  ['s4', 'Tetanus booster'],
  ['s4', 'Flu shot'],
];

const SEED_HISTORY = [
  ['h1', 's4', 'Vaccinations', '2026-09-28', 'seen'],
  ['h2', 's1', 'Sick Visit', '2026-08-14', 'seen'],
  ['h3', 's3', 'Lab Work', '2026-07-02', 'cancelled'],
];

export function seedTables() {
  const startedAt = Date.now() - waitingRoom.length * 60_000;

  const queueEntries = waitingRoom.map(([serviceId, reason], index) => ({
    id: `q-seed-${index + 1}`,
    userId: `u-seed-${index + 1}`,
    serviceId,
    reason,
    status: 'waiting',
    priority: 'normal',
    order: index + 1,
    arrivedAt: startedAt + index * 60_000,
    calledAt: null,
    leftAt: null,
  }));

  // Past visits for the demo patient, so statistics have something to read.
  const history = SEED_HISTORY.map(([id, serviceId, serviceName, date, outcome]) => {
    const leftAt = Date.parse(`${date}T15:00:00Z`);
    return {
      id,
      userId: 'u-patient',
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
    users: [
      ...SEED_USERS.map((row) => ({ ...row })),
      ...waitingRoom.map((_, index) => ({
        id: `u-seed-${index + 1}`,
        name: `Demo Patient ${index + 1}`,
        dob: '1990-01-01',
        email: `seed-patient-${index + 1}@queuesmart.test`,
        phone: null,
        passwordHash: null,
        role: 'user',
      })),
    ],
    services: SEED_SERVICES.map((row) => ({ ...row })),
    queueEntries,
    history,
    // Messages the demo patient was sent on past visits, already read.
    notifications: history
      .filter((row) => row.outcome === 'seen')
      .map((row, index) => ({
        id: `n-seed-${index + 1}`,
        userId: 'u-patient',
        title: `${row.serviceName}: it is your turn`,
        message: 'Please come to the front desk now.',
        createdAt: row.calledAt,
        status: 'viewed',
      })),
  };
}

// Visits that already finished today, so the admin dashboard's statistics
// and the front desk have a realistic day to show. Only `npm run db:seed`
// adds these; the tests start from seedTables() alone.
const FINISHED_TODAY = [
  ['s1', 'seen', 22],
  ['s1', 'seen', 35],
  ['s1', 'no-show', null],
  ['s2', 'seen', 18],
  ['s3', 'seen', 9],
  ['s3', 'cancelled', null],
  ['s4', 'seen', 6],
  ['s4', 'removed', null],
];

// History outcome -> the status its queue entry ends with.
const ENTRY_STATUS = { seen: 'served', 'no-show': 'no-show', cancelled: 'canceled', removed: 'removed' };

export function sampleTables(now = Date.now()) {
  const services = Object.fromEntries(SEED_SERVICES.map((service) => [service.id, service.name]));
  const users = [];
  const queueEntries = [];
  const history = [];

  FINISHED_TODAY.forEach(([serviceId, outcome, waitMinutes], index) => {
    const number = index + 1;
    const userId = `u-sample-${number}`;
    const joinedAt = now - (4 * 60 - index * 15) * 60_000;
    const calledAt = waitMinutes === null ? null : joinedAt + waitMinutes * 60_000;
    const leftAt = (calledAt ?? joinedAt + 20 * 60_000) + 10 * 60_000;

    users.push({
      id: userId,
      name: `Sample Patient ${number}`,
      dob: `198${number}-0${number}-1${number}`,
      email: `sample-patient-${number}@queuesmart.test`,
      phone: `713555${String(200 + number).padStart(4, '0')}`,
      passwordHash: null,
      role: 'user',
    });
    queueEntries.push({
      id: `q-sample-${number}`,
      userId,
      serviceId,
      reason: 'Earlier visit today',
      status: ENTRY_STATUS[outcome],
      priority: 'normal',
      order: 100 + number,
      arrivedAt: joinedAt,
      calledAt,
      leftAt,
    });
    history.push({
      id: `h-sample-${number}`,
      userId,
      serviceId,
      serviceName: services[serviceId],
      date: new Date(leftAt).toISOString().slice(0, 10),
      joinedAt,
      calledAt,
      leftAt,
      outcome,
    });
  });

  return { users, queueEntries, history };
}
