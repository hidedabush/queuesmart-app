/**
 * Provider office business rules.
 *
 * QueueSmart runs the walk-in line for a primary-care provider office:
 * patients check in from their phone for a visit type, wait wherever they
 * like, and come in when the front desk calls them. Every policy lives here
 * so the backend, the screens and the README all describe the same rules.
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

export const EMERGENCY_NOTICE =
  'Not for emergencies. For chest pain, trouble breathing, severe bleeding, or any other emergency, call 911.';

export function validateReason(reason) {
  const text = (reason ?? '').trim();
  if (!text) return 'Tell us briefly why you are coming in.';
  if (text.length < REASON_MIN) return `Use at least ${REASON_MIN} characters.`;
  if (text.length > REASON_MAX) return `Keep it to ${REASON_MAX} characters or fewer.`;
  return null;
}

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

// Where a waiting patient stands, from the number of people ahead of them.
export function patientStatus(entry, peopleAhead) {
  if (entry.status === 'called') return 'called';
  return peopleAhead <= HEAD_IN_AHEAD ? 'head-in' : 'waiting';
}
