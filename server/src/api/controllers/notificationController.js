import * as notifications from '../notifications/notificationService.js';

export async function listMine(req, res) {
  res.json(await notifications.listMine(req.user.id));
}

export async function markRead(req, res) {
  res.json(await notifications.markRead(req.user.id, req.params.id));
}

export async function markAllRead(req, res) {
  res.json(await notifications.markAllRead(req.user.id));
}
