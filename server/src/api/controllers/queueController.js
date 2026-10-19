import * as queue from '../services/queueService.js';

// Patient
export function join(req, res) {
  res.status(201).json({ entry: queue.join(req.user, req.params.id, req.body.reason) });
}

export function mine(req, res) {
  res.json({ entry: queue.getMyEntry(req.user.id) });
}

export function leave(req, res) {
  queue.leave(req.user.id);
  res.status(204).end();
}

// Front desk
export function line(req, res) {
  res.json(queue.getLineForStaff(req.params.id));
}

export function callNext(req, res) {
  res.json({ called: queue.callNext(req.params.id) });
}

export function resolveCalled(req, res) {
  res.json({ resolved: queue.resolveCalled(req.params.id, req.body.outcome) });
}

export function updateEntry(req, res) {
  res.json({ waiting: queue.updateEntry(req.params.entryId, req.body) });
}

export function removeEntry(req, res) {
  queue.removeEntry(req.params.entryId);
  res.status(204).end();
}
