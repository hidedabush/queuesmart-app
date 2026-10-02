import * as queue from '../backend/queueService';

// Queue API for the signed-in user. See services.js for how this layer is
// meant to change in A3.

// GET /queue/me
export function getActiveQueue() {
  return queue.getActiveQueue();
}

// POST /services/:id/queue
export function joinQueue(serviceId) {
  return queue.joinQueue(serviceId);
}

// DELETE /queue/me
export function leaveQueue() {
  return queue.leaveQueue();
}
