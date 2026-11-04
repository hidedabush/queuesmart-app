import * as staffQueue from '../services/staffQueueService.js';

export async function getLine(req, res) {
  res.json(await staffQueue.getLine(req.params.id));
}

export async function callNext(req, res) {
  res.json(await staffQueue.callNext(req.params.id));
}

export async function resolveCalled(req, res) {
  res.json(await staffQueue.resolveCalled(req.params.id, req.body.outcome));
}

export async function moveEntry(req, res) {
  res.json(await staffQueue.moveEntry(req.params.entryId, req.body));
}

export async function removeEntry(req, res) {
  await staffQueue.removeEntry(req.params.entryId);
  res.status(204).end();
}