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
