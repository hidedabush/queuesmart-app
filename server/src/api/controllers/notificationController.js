import * as notifications from '../notifications/notificationService.js';

export function listMine(req, res) {
  res.json(notifications.listMine(req.user.id));
}

export function markRead(req, res) {
  res.json(notifications.markRead(req.user.id, req.params.id));
}

export function markAllRead(req, res) {
  res.json(notifications.markAllRead(req.user.id));
}