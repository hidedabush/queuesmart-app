/**
 * Provider office business rules (moved from the app's src/backend in A2).
 *
 * QueueSmart runs the walk-in line for a primary-care provider office:
 * patients check in from their phone for a visit type, wait wherever they
 * like, and come in when the front desk calls them. Every policy lives here
 * so the API, the screens and the README all describe the same rules.
 */

// Reason for visit: required at check-in, short, and shown to staff only.
export const REASON_MIN = 3;
export const REASON_MAX = 120;

// Patients are told to head to the office once this many people or fewer
// are ahead of them, so they arrive before they are called.
export const HEAD_IN_AHEAD = 2;

// After being called, a patient has this long to reach the front desk
// before staff may mark them as a no-show and release the spot.
export const NO_SHOW_GRACE_MINUTES = 10;

// Daily walk-in capacity per visit type. Check-in closes when the line is full.
export const DEFAULT_CAPACITY = 15;
export const MAX_CAPACITY = 50;

// Why a patient cannot check in right now, or null if they can.
export function checkInBlocker(service, waiting, alreadyCheckedIn) {
  if (!service) return 'missing';
  if (alreadyCheckedIn) return 'already-checked-in';
  if (!service.isOpen) return 'closed';
  if (waiting >= service.capacity) return 'full';
  return null;
}

// Privacy: lists show first name and last initial only ("Maria G.").
export function displayName(fullName) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Patient';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// Where a patient stands, from the number of people ahead of them.
export function patientStatus(entry, peopleAhead) {
  if (entry.status === 'called') return 'called';
  return peopleAhead <= HEAD_IN_AHEAD ? 'head-in' : 'waiting';
}
