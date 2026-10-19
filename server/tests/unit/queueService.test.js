import { describe, expect, it } from 'vitest';
import * as queue from '../../src/api/services/queueService.js';
import * as services from '../../src/api/services/servicesService.js';
import * as historyRepo from '../../src/database/repositories/historyRepo.js';
import { PATIENT } from '../helpers.js';

const patient = { id: PATIENT.id };
const conflictCode = (code) => expect.objectContaining({ status: 409, code });
const names = (serviceId) => queue.getLineForStaff(serviceId).waiting.map((e) => e.patientName);
const lastHistory = () => historyRepo.listByUser(PATIENT.id).at(-1);

describe('joining and leaving', () => {
  it('puts a new patient at the back with a wait estimate', () => {
    const mine = queue.join(patient, 's1', 'Sore throat');
    expect(mine).toMatchObject({
      serviceName: 'Sick Visit',
      position: 7,
      peopleAhead: 6,
      status: 'waiting',
      estimatedWait: { low: 90, high: 117 },
    });
    expect(queue.getMyEntry(PATIENT.id).id).toBe(mine.id);
  });

  it('allows one check-in at a time', () => {
    queue.join(patient, 's1', 'Sore throat');
    expect(() => queue.join(patient, 's3', 'Blood work')).toThrow(conflictCode('already-checked-in'));
  });

  it('blocks closed and full lines', () => {
    expect(() => queue.join(patient, 's5', 'Refill please')).toThrow(conflictCode('closed'));
    services.updateService('s2', { capacity: 2 });
    expect(() => queue.join(patient, 's2', 'Sprained wrist')).toThrow(conflictCode('full'));
  });

  it('returns 404 for an unknown visit type', () => {
    expect(() => queue.join(patient, 'nope', 'Anything')).toThrow(
      expect.objectContaining({ status: 404 })
    );
  });

  it('leaving removes the entry and records "cancelled"', () => {
    queue.join(patient, 's1', 'Sore throat');
    queue.leave(PATIENT.id);
    expect(queue.getMyEntry(PATIENT.id)).toBeNull();
    expect(lastHistory()).toMatchObject({ serviceName: 'Sick Visit', outcome: 'cancelled' });
  });

  it('leaving without a check-in is a 404', () => {
    expect(() => queue.leave(PATIENT.id)).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('says "head-in" once 2 or fewer are ahead', () => {
    expect(queue.join(patient, 's2', 'Small cut').status).toBe('head-in');
  });
});

describe('ordering: arrival order, then priority', () => {
  it('without urgent patients the line is in arrival order', () => {
    expect(names('s1')).toEqual([
      'Maria Gonzalez',
      'James Thompson',
      'Aisha Rahman',
      'Daniel Kim',
      'Linh Pham',
      'Robert Miller',
    ]);
  });

  it('an urgent patient moves ahead and everyone else keeps their order', () => {
    const daniel = queue.getLineForStaff('s1').waiting[3];
    queue.updateEntry(daniel.id, { priority: 'urgent' });
    expect(names('s1')).toEqual([
      'Daniel Kim',
      'Maria Gonzalez',
      'James Thompson',
      'Aisha Rahman',
      'Linh Pham',
      'Robert Miller',
    ]);
  });

  it('two urgent patients keep arrival order between them', () => {
    const line = queue.getLineForStaff('s1').waiting;
    queue.updateEntry(line[5].id, { priority: 'urgent' });
    queue.updateEntry(line[2].id, { priority: 'urgent' });
    expect(names('s1').slice(0, 2)).toEqual(['Aisha Rahman', 'Robert Miller']);
  });

  it('moving swaps neighbours with the same priority only', () => {
    const line = queue.getLineForStaff('s1').waiting;
    queue.updateEntry(line[1].id, { direction: -1 });
    expect(names('s1').slice(0, 2)).toEqual(['James Thompson', 'Maria Gonzalez']);

    queue.updateEntry(line[3].id, { priority: 'urgent' });
    const urgentFirst = queue.getLineForStaff('s1').waiting;
    // Daniel is urgent; the normal patient behind him can't jump past him.
    queue.updateEntry(urgentFirst[1].id, { direction: -1 });
    expect(names('s1')[0]).toBe('Daniel Kim');
  });

  it('moving off the end of the line changes nothing', () => {
    const before = names('s1');
    const line = queue.getLineForStaff('s1').waiting;
    queue.updateEntry(line[0].id, { direction: -1 });
    queue.updateEntry(line.at(-1).id, { direction: 1 });
    expect(names('s1')).toEqual(before);
  });

  it('a called patient is not moved or re-prioritised', () => {
    const called = queue.callNext('s2');
    queue.updateEntry(called.id, { priority: 'urgent' });
    queue.updateEntry(called.id, { direction: 1 });
    expect(queue.getLineForStaff('s2').called).toMatchObject({ id: called.id, priority: 'normal' });
  });

  it('updating an unknown entry is a 404', () => {
    expect(() => queue.updateEntry('nope', { direction: 1 })).toThrow(
      expect.objectContaining({ status: 404 })
    );
  });
});

describe('serving the next patient', () => {
  it('calls the first patient in sorted order', () => {
    const urgent = queue.getLineForStaff('s1').waiting[4];
    queue.updateEntry(urgent.id, { priority: 'urgent' });
    expect(queue.callNext('s1').patientName).toBe('Linh Pham');
    expect(queue.getLineForStaff('s1').waiting).toHaveLength(5);
  });

  it('only one patient per line can be called at a time', () => {
    queue.callNext('s1');
    expect(() => queue.callNext('s1')).toThrow(conflictCode('already-calling'));
  });

  it('cannot call from an empty line', () => {
    services.createService({ name: 'Empty Line', description: 'x', expectedDuration: 5, priority: 'low' });
    const empty = services.listServices().find((s) => s.name === 'Empty Line');
    expect(() => queue.callNext(empty.id)).toThrow(conflictCode('empty'));
  });

  it('marks the called patient seen and records it', () => {
    queue.join(patient, 's2', 'Small cut');
    queue.callNext('s2');
    queue.resolveCalled('s2', 'seen');
    queue.callNext('s2');
    queue.resolveCalled('s2', 'no-show');
    queue.callNext('s2');
    expect(queue.getMyEntry(PATIENT.id)).toMatchObject({ status: 'called', position: 0 });
    const resolved = queue.resolveCalled('s2', 'seen');
    expect(resolved.patientName).toBe('Alex Rivera');
    expect(lastHistory()).toMatchObject({ outcome: 'seen', serviceName: 'Minor Injury' });
  });

  it('resolving with nobody called is a conflict', () => {
    expect(() => queue.resolveCalled('s1', 'seen')).toThrow(conflictCode('nothing-called'));
  });

  it('staff can remove a patient, which records "removed"', () => {
    const mine = queue.join(patient, 's1', 'Sore throat');
    queue.removeEntry(mine.id);
    expect(queue.getMyEntry(PATIENT.id)).toBeNull();
    expect(lastHistory().outcome).toBe('removed');
    expect(() => queue.removeEntry(mine.id)).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('the staff view shows full name and DOB plus the private display name', () => {
    const [first] = queue.getLineForStaff('s1').waiting;
    expect(first).toMatchObject({
      patientName: 'Maria Gonzalez',
      displayName: 'Maria G.',
      dob: '1988-04-12',
      position: 1,
    });
    expect(() => queue.getLineForStaff('nope')).toThrow(expect.objectContaining({ status: 404 }));
  });
});
