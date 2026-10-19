// Starting rows for the in-memory database: a primary-care provider office
// that takes same-day walk-in visits. The shape of each row is deliberately
// close to what we expect the real tables to hold in A3. All names are
// fictional.

// Visit types. `priority` is the urgency level (low = Routine,
// medium = Standard, high = Urgent); `capacity` is the daily walk-in limit.
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

// Everyone currently in line, across all visit types. `order` is check-in
// order; the front desk can swap it to move a patient up or down.
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

export const SEED_QUEUE_ENTRIES = waitingRoom.map(([serviceId, patientName, dob, reason], index) => ({
  id: `q-seed-${index + 1}`,
  serviceId,
  patientName,
  dob,
  reason,
  status: 'waiting',
  order: index + 1,
  isCurrentUser: false,
}));

// The signed-in patient's past visits, newest first.
export const SEED_VISIT_HISTORY = [
  { id: 'h1', serviceName: 'Vaccinations', date: '2026-09-28', outcome: 'seen' },
  { id: 'h2', serviceName: 'Sick Visit', date: '2026-08-14', outcome: 'seen' },
  { id: 'h3', serviceName: 'Lab Work', date: '2026-07-02', outcome: 'cancelled' },
];
