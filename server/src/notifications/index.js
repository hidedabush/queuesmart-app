import { HEAD_IN_AHEAD } from '../api/services/officeRules.js';
import * as messages from './messages.js';
import * as outbox from './outbox.js';
import { smsGateway } from './smsGateway.js';

/**
 * The "Notification component" from the A1 container diagram.
 *
 * The API reports what happened through trigger(event) (the "Alerts
 * triggers" arrow). This module decides who to alert and when, stores the
 * in-app copy in its outbox, and hands a text to the SMS gateway when the
 * patient gave a phone number (the "send message off to" arrow).
 *
 * Events
 *   { type: 'joined', serviceName, entry, recipient, position, estimatedWait }
 *   { type: 'called', serviceName, entry, recipient }
 *   { type: 'line-changed', serviceName, line: [{ entry, recipient, peopleAhead }] }
 * recipient = { userId, phone }
 */
export function trigger(event) {
  switch (event.type) {
    case 'joined':
      return [deliver('joined', event.entry, event.recipient, messages.joined(event))];
    case 'called':
      return [deliver('called', event.entry, event.recipient, messages.called(event))];
    case 'line-changed':
      // Anyone now close to the front gets one "head in" alert per check-in.
      return event.line
        .filter(({ entry, peopleAhead }) => entry.status === 'waiting' && peopleAhead <= HEAD_IN_AHEAD)
        .map(({ entry, recipient }) => deliver('almost-up', entry, recipient, messages.almostUp(event)));
    default:
      return [];
  }
}

// One alert, at most once per (check-in, type). Returns null for a repeat.
function deliver(type, entry, recipient, { title, message }) {
  if (outbox.has(entry.id, type)) return null;

  const channels = ['in-app'];
  if (recipient.phone) {
    smsGateway.send(recipient.phone, `QueueSmart - ${title}. ${message}`);
    channels.push('sms');
  }

  return outbox.add({
    userId: recipient.userId,
    entryId: entry.id,
    serviceId: entry.serviceId,
    type,
    title,
    message,
    channels,
  });
}

export { outbox, smsGateway };
