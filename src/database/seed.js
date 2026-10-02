// Starting rows for the in-memory database. The shape of each row is
// deliberately close to what we expect the real tables to hold in A3.

export const SEED_SERVICES = [
  {
    id: 's1',
    name: 'Academic Advising',
    description: 'Degree planning, course selection, and registration holds.',
    expectedDuration: 15,
    priority: 'medium',
    isOpen: true,
    waiting: 7,
  },
  {
    id: 's2',
    name: 'Financial Aid',
    description: 'Award questions, appeals, and disbursement issues.',
    expectedDuration: 20,
    priority: 'high',
    isOpen: true,
    waiting: 12,
  },
  {
    id: 's3',
    name: 'ID Card Services',
    description: 'New cards, replacements, and photo updates.',
    expectedDuration: 5,
    priority: 'low',
    isOpen: true,
    waiting: 3,
  },
  {
    id: 's4',
    name: 'Registrar — Transcripts',
    description: 'Official transcript requests and enrollment verification.',
    expectedDuration: 10,
    priority: 'low',
    isOpen: false,
    waiting: 0,
  },
];

// The signed-in user's place in a queue. Empty until they join one.
export const SEED_QUEUE_ENTRIES = [];
