import { hashPassword } from '../api/services/password.js';

// Starting rows for the in-memory database: a primary-care provider office
// that takes same-day walk-in visits. All names are fictional. The two demo
// passwords below are for this in-memory demo only.

export const DEMO_ADMIN = { email: 'admin@queuesmart.test', password: 'Admin#2026' };
export const DEMO_PATIENT = { email: 'patient@queuesmart.test', password: 'Patient#2026' };

// Hashing is deliberately slow, so do it once when the server starts rather
// than every time the tables are reset.
const adminLogin = hashPassword(DEMO_ADMIN.password);
const patientLogin = hashPassword(DEMO_PATIENT.password);

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

// Everyone already in line when the server starts. Each one is a user with
// no password (they can't sign in) so every queue entry has a userId.
const waitingRoom = [
  ['s1', 'Maria Gonzalez', '1988-04-12', 'Fever and sore throat since Tuesday'],
  ['s1', 'James Thompson', '1975-09-30', 'Ear pain, left side'],
  ['s1', 'Aisha Rahman', '1996-01-08', 'Cough for about a week'],
  ['s1', 'Daniel Kim', '2001-06-21', 'Itchy rash on forearm'],
  ['s1', 'Linh Pham', '1983-11-02', 'Sinus pressure and headache'],
  ['s1', 'Robert Miller', '1960-03-17', 'Stomach pain since last night'],
  ['s2', 'Sofia Lopez', '2008-07-04', 'Twisted ankle at soccer practice'],
  ['s2', 'Ethan Walker', '1992-12-19', 'Small cut on finger, needs a look'],
  ['s3', 'Grace Huang', '1979-05-25', 'Fasting blood work for annual physical'],
  ['s3', 'Omar Siddiqui', '1968-10-11', 'Cholesterol panel'],
  ['s3', 'Hannah Brooks', '1990-02-14', 'A1C check'],
  ['s3', 'Victor Nguyen', '1955-08-03', 'Thyroid panel'],
  ['s4', 'Chloe Dubois', '1999-03-29', 'Flu shot'],
  ['s4', 'Marcus Johnson', '1987-12-01', 'Tetanus booster'],
  ['s4', 'Priya Venkat', '1972-06-16', 'Flu shot'],
];

const SEED_HISTORY = [
  ['h1', 's4', 'Vaccinations', '2026-09-28', 'seen'],
  ['h2', 's1', 'Sick Visit', '2026-08-14', 'seen'],
  ['h3', 's3', 'Lab Work', '2026-07-02', 'cancelled'],
];

export function seedTables() {
  const startedAt = Date.now() - waitingRoom.length * 60_000;

  const users = [
    {
      id: 'u-admin',
      name: 'Front Desk',
      dob: '1980-01-01',
      email: DEMO_ADMIN.email,
      phone: null,
      ...adminLogin,
      role: 'admin',
      createdAt: startedAt,
    },
    {
      id: 'u-patient',
      name: 'Alex Rivera',
      dob: '1994-05-20',
      email: DEMO_PATIENT.email,
      phone: '7135550100',
      ...patientLogin,
      role: 'user',
      createdAt: startedAt,
    },
    ...waitingRoom.map(([, name, dob], index) => ({
      id: `u-seed-${index + 1}`,
      name,
      dob,
      email: `seed${index + 1}@queuesmart.test`,
      phone: null,
      passwordHash: null,
      salt: null,
      role: 'user',
      createdAt: startedAt,
    })),
  ];

  const queueEntries = waitingRoom.map(([serviceId, , , reason], index) => ({
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
    users,
    services: SEED_SERVICES.map((row) => ({ ...row })),
    queueEntries,
    history,
  };
}
