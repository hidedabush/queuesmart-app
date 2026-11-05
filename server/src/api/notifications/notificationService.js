import * as notificationRepo from '../../database/repositories/notificationRepo.js';
import * as userRepo from '../../database/repositories/userRepo.js';
import { notFound } from '../errors.js';
import { HEAD_IN_AHEAD } from '../services/lineRules.js';
import { almostUpMessage, calledMessage, joinedMessage } from './messages.js';

/**
 * The "Notification component" from the A1 container diagram: decides who to
 * tell and when. Notifications are stored for the app to show as a popup and
 * in the bell list. Nothing is really sent: a patient with a phone number
 * only gets the "sms" channel label and a log line, because A1's SMS provider
 * is an external system we do not call yet. Messages never include the
 * reason for the visit.
 *
 * The queue code calls these after it changes a line:
 *   notifyJoined      a patient checked in
 *   notifyLineChanged the line changed (queueService.announceLineChange)
 *   notifyCalled      staff called a patient
 *   closeForEntry     the patient left the line, so their notices are done
 */

function toPublicNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    serviceId: row.serviceId,
    entryId: row.entryId,
    read: row.read,
    createdAt: row.createdAt,
    channels: row.channels,
  };
}

// A patient with no account (an unknown userId) is skipped quietly.
async function create(entry, type, service, text) {
  const user = await userRepo.findById(entry.userId);
  if (!user) return null;

  const channels = user.phone ? ['in-app', 'sms'] : ['in-app'];
  const row = await notificationRepo.insert({
    userId: user.id,
    type,
    title: text.title,
    message: text.message,
    serviceId: service.id,
    entryId: entry.id,
    read: false,
    createdAt: Date.now(),
    channels,
  });

  if (channels.includes('sms') && !process.env.VITEST) {
    console.log(`[sms -> ***${user.phone.slice(-4)}] ${row.title}. ${row.message}`);
  }
  return toPublicNotification(row);
}

export function notifyJoined(entry, service, position, estimatedWait) {
  return create(entry, 'joined', service, joinedMessage(service.name, position, estimatedWait));
}

// `orderedLine` is the service's waiting line in serving order. Anyone with
// HEAD_IN_AHEAD or fewer patients ahead is told once to head to the office.
export async function notifyLineChanged(service, orderedLine) {
  for (const [peopleAhead, entry] of orderedLine.entries()) {
    if (peopleAhead > HEAD_IN_AHEAD) break;
    if (await notificationRepo.hasForEntry(entry.userId, entry.id, 'almost-up')) continue;
    await create(entry, 'almost-up', service, almostUpMessage(service.name));
  }
}

export function notifyCalled(entry, service) {
  return create(entry, 'called', service, calledMessage(service.name));
}

// The patient left the line (cancelled, seen, no-show or removed), so any
// notice still unread for that check-in is out of date.
export function closeForEntry(entryId) {
  return notificationRepo.markEntryRead(entryId);
}

export async function listMine(userId) {
  const rows = await notificationRepo.listByUser(userId);
  return {
    notifications: rows.map(toPublicNotification),
    unread: rows.filter((row) => !row.read).length,
  };
}

// Someone else's notification looks the same as one that does not exist.
export async function markRead(userId, id) {
  const row = await notificationRepo.findById(id);
  if (!row || row.userId !== userId) throw notFound('Notification not found.');
  return { notification: toPublicNotification(await notificationRepo.update(id, { read: true })) };
}

export async function markAllRead(userId) {
  await notificationRepo.markAllRead(userId);
  return { unread: 0 };
}
