/**
 * Office rules the screens need for instant feedback while typing, copied
 * from server/src/api/services/officeRules.js. The server checks everything
 * again and its answer is the one that counts; keep the two in step.
 */

export const REASON_MIN = 3;
export const REASON_MAX = 120;
export const HEAD_IN_AHEAD = 2;
export const NO_SHOW_GRACE_MINUTES = 10;
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

// Privacy: lists show first name and last initial only ("Maria G.").
export function displayName(fullName) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Patient';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/**
 * The server sends `estimatedWait` with every visit type. The local
 * fallback (people waiting x minutes each, up to 30% longer) is only for
 * the live preview on the edit form, which shows unsaved values.
 */
export function estimateWait(service) {
  if (service.estimatedWait !== undefined) return service.estimatedWait;
  if (!service.isOpen || !service.waiting) return null;
  const low = service.waiting * service.expectedDuration;
  return { low, high: Math.round(low * 1.3) };
}

export function formatWait(service) {
  const estimate = estimateWait(service);
  if (!estimate) return service.isOpen ? 'No wait' : 'Closed';
  return `${estimate.low}–${estimate.high} min`;
}
