import { describe, expect, it, vi } from 'vitest';
import * as queue from '../../src/api/services/queueService.js';
import { outbox, smsGateway, trigger } from '../../src/notifications/index.js';
import { MockSmsGateway } from '../../src/notifications/smsGateway.js';
import * as usersRepo from '../../src/database/repositories/usersRepo.js';
import { PATIENT } from '../helpers.js';

const patient = { id: PATIENT.id };
const typesFor = (userId) => outbox.listForUser(userId).map((n) => n.type);

describe('notification triggers', () => {
  it('sends "joined" with position and wait when a patient checks in', () => {
    queue.join(patient, 's1', 'Sore throat');
    const [joined] = outbox.listForUser(PATIENT.id);
    expect(joined).toMatchObject({
      type: 'joined',
      title: "Sick Visit: you're checked in",
      message: "You're #7 in line, about 90-117 min.",
    });
  });

  it('sends "almost-up" once a patient is 2 or fewer from the front', () => {
    queue.join(patient, 's1', 'Sore throat'); // 6 ahead
    expect(typesFor(PATIENT.id)).toEqual(['joined']);
    for (let i = 0; i < 4; i += 1) {
      queue.callNext('s1');
      queue.resolveCalled('s1', 'seen');
    }
    expect(typesFor(PATIENT.id)).toContain('almost-up');
  });

  it('never repeats the same alert for the same check-in', () => {
    queue.join(patient, 's2', 'Small cut'); // already close: joined + almost-up
    const [first] = queue.getLineForStaff('s2').waiting;
    queue.updateEntry(first.id, { direction: 1 });
    queue.updateEntry(first.id, { direction: -1 });
    const almostUps = typesFor(PATIENT.id).filter((type) => type === 'almost-up');
    expect(almostUps).toHaveLength(1);
  });

  it('sends "called" when staff call the patient', () => {
    queue.join(patient, 's2', 'Small cut');
    queue.callNext('s2');
    queue.resolveCalled('s2', 'seen');
    queue.callNext('s2');
    queue.resolveCalled('s2', 'seen');
    queue.callNext('s2');
    expect(typesFor(PATIENT.id)[0]).toBe('called');
  });

  it('never includes the reason for the visit', () => {
    queue.join(patient, 's2', 'Very private reason');
    for (let i = 0; i < 3; i += 1) {
      queue.callNext('s2');
      if (i < 2) queue.resolveCalled('s2', 'seen');
    }
    const text = JSON.stringify(outbox.listForUser(PATIENT.id)) + JSON.stringify(smsGateway.sent);
    expect(text).not.toContain('Very private reason');
  });

  it('texts patients with a phone number and keeps others in-app only', () => {
    queue.join(patient, 's1', 'Sore throat');
    expect(outbox.listForUser(PATIENT.id)[0].channels).toEqual(['in-app', 'sms']);
    expect(smsGateway.sent[0].to).toBe('7135550100');

    usersRepo.update(PATIENT.id, { phone: null });
    queue.leave(PATIENT.id);
    smsGateway.clear();
    queue.join(patient, 's3', 'Blood work');
    const latest = outbox.listForUser(PATIENT.id).find((n) => n.serviceId === 's3');
    expect(latest.channels).toEqual(['in-app']);
    expect(smsGateway.sent.filter((m) => m.to === '7135550100')).toHaveLength(0);
  });

  it('ignores unknown event types', () => {
    expect(trigger({ type: 'something-else' })).toEqual([]);
  });
});

describe('outbox', () => {
  it('marks one or all notifications read, for their owner only', () => {
    queue.join(patient, 's2', 'Small cut');
    const [first] = outbox.listForUser(PATIENT.id);
    expect(outbox.markRead(first.id, 'someone-else')).toBeNull();
    expect(outbox.markRead(first.id, PATIENT.id).read).toBe(true);
    outbox.markAllRead(PATIENT.id);
    expect(outbox.listForUser(PATIENT.id).every((n) => n.read)).toBe(true);
  });
});

describe('MockSmsGateway', () => {
  it('logs and records each message', () => {
    const log = vi.fn();
    const sms = new MockSmsGateway(log);
    sms.send('7135550100', 'Hello');
    expect(sms.sent).toEqual([expect.objectContaining({ to: '7135550100', text: 'Hello' })]);
    expect(log).toHaveBeenCalledWith('[SMS -> 7135550100] Hello');
    sms.clear();
    expect(sms.sent).toEqual([]);
  });
});
