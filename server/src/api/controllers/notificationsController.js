import { outbox } from '../../notifications/index.js';
import { notFound } from '../errors.js';

export function list(req, res) {
  const notifications = outbox.listForUser(req.user.id);
  res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
}

// Someone else's notification looks the same as a missing one.
export function markRead(req, res) {
  const notification = outbox.markRead(req.params.id, req.user.id);
  if (!notification) throw notFound('Notification not found.');
  res.json({ notification });
}

export function markAllRead(req, res) {
  outbox.markAllRead(req.user.id);
  res.json({ unread: 0 });
}
