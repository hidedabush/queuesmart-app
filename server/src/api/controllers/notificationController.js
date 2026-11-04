import * as notifications from '../services/notificationService.js';

export async function listMine(req, res) {
  res.json(await notifications.listMine(req.user.id));
}

export async function markViewed(req, res) {
  await notifications.markViewed(req.user.id, req.params.id);
  res.status(204).end();
}

export async function markAllViewed(req, res) {
  await notifications.markAllViewed(req.user.id);
  res.status(204).end();
}
