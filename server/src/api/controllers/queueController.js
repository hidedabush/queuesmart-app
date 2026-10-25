import * as queueService from '../services/queueService.js';

// These handlers assume authentication middleware provides req.user.id.
// Confirm that contract before mounting the routes.

export function join(req, res) {
  const result = queueService.joinQueue(
    req.user.id,
    req.params.id,
    req.body.reason
  );

  res.status(201).json(result);
}

export function getMine(req, res) {
  const result = queueService.getMyQueue(req.user.id);

  res.json(result ?? { entry: null });
}

export function cancelMine(req, res) {
  queueService.cancelQueue(req.user.id);

  res.status(204).end();
}

// Staff (front desk) handlers.

export function line(req, res) {
  res.json(queueService.getLine(req.params.id));
}

export function callNext(req, res) {
  res.json(queueService.callNext(req.params.id));
}

export function resolveCalled(req, res) {
  res.json(queueService.resolveCalled(req.params.id, req.body.outcome));
}

export function updateEntry(req, res) {
  res.json(queueService.updateEntry(req.params.entryId, req.body));
}

export function removeEntry(req, res) {
  queueService.removeEntry(req.params.entryId);

  res.status(204).end();
}
