import * as staffQueue from '../services/staffQueueService.js';

export function getLine(req, res) {
  res.json(staffQueue.getLine(req.params.id));
}

export function callNext(req, res) {
  res.json(staffQueue.callNext(req.params.id));
}

export function resolveCalled(req, res) {
  res.json(staffQueue.resolveCalled(req.params.id, req.body.outcome));
}

export function moveEntry(req, res) {
  res.json(staffQueue.moveEntry(req.params.entryId, req.body));
}

export function removeEntry(req, res) {
  staffQueue.removeEntry(req.params.entryId);
  res.status(204).end();
}