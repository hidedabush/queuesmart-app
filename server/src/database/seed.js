// Starting rows for the in-memory database: a primary-care provider office
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
  };
}
