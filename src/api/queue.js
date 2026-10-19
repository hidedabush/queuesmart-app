import * as queue from '../backend/queueService';

// Queue API: the signed-in patient's check-in, and the front desk's view of
// each line. See services.js for how this layer is meant to change in A3.

// GET /queue/me
export function getActiveQueue() {
  return queue.getActiveQueue();
}

// POST /services/:id/queue  { reason }
export function checkIn(serviceId, patient, reason) {
  return queue.checkIn(serviceId, patient, reason);
}

// DELETE /queue/me
export function cancelCheckIn() {
  return queue.cancelCheckIn();
}

// GET /queue/me/history
export function listVisitHistory() {
  return queue.listVisitHistory();
}

// GET /services/:id/queue  (staff only)
export function listQueue(serviceId) {
  return queue.listQueue(serviceId);
}

// GET /services/:id/queue/called  (staff only)
export function getCalled(serviceId) {
  return queue.getCalled(serviceId);
}

// POST /services/:id/queue/call  (staff only)
export function callNext(serviceId) {
  return queue.callNext(serviceId);
}

// POST /services/:id/queue/called  { outcome: 'seen' | 'no-show' }  (staff only)
export function resolveCalled(serviceId, outcome) {
  return queue.resolveCalled(serviceId, outcome);
}

// PATCH /queue/:entryId  { direction }  (staff only)
export function moveEntry(serviceId, entryId, direction) {
  return queue.moveEntry(serviceId, entryId, direction);
}

// DELETE /queue/:entryId  (staff only)
export function removeEntry(entryId) {
  return queue.removeEntry(entryId);
}

// Office policy shared with the screens.
export {
  EMERGENCY_NOTICE,
  HEAD_IN_AHEAD,
  NO_SHOW_GRACE_MINUTES,
  REASON_MAX,
  displayName,
  validateReason,
} from '../backend/officeRules';
