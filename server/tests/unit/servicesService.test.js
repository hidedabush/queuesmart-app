import { describe, expect, it } from 'vitest';
import * as services from '../../src/api/services/servicesService.js';
import { addToLine, clearLine, validService } from '../helpers.js';

const conflictCode = (code) => expect.objectContaining({ status: 409, code });

describe('service management', () => {
  it('lists every visit type with its live line', () => {
    const list = services.listServices();
    expect(list).toHaveLength(5);
    const sick = list.find((s) => s.id === 's1');
    expect(sick).toMatchObject({ waiting: 6, hasCalled: false, estimatedWait: { low: 90, high: 117 } });
  });

  it('counts a called patient separately from the waiting ones', () => {
    addToLine('s3', 'called');
    expect(services.getService('s3')).toMatchObject({ waiting: 4, hasCalled: true });
  });

  it('creates an open visit type with the default capacity', () => {
    const { capacity, ...draft } = validService();
    const created = services.createService(draft);
    expect(created).toMatchObject({ isOpen: true, capacity: 15, waiting: 0, estimatedWait: null });
    expect(services.getService(created.id).name).toBe('Allergy Shots');
  });

  it('refuses a duplicate name, ignoring case', () => {
    expect(() => services.createService(validService({ name: 'sick visit' }))).toThrow(
      conflictCode('name-taken')
    );
  });

  it('updates fields and allows keeping its own name', () => {
    const updated = services.updateService('s1', { name: 'Sick Visit', expectedDuration: 20 });
    expect(updated.expectedDuration).toBe(20);
    expect(() => services.updateService('s1', { name: 'Lab Work' })).toThrow(conflictCode('name-taken'));
  });

  it('refuses a capacity below the number already waiting', () => {
    expect(() => services.updateService('s1', { capacity: 5 })).toThrow(
      conflictCode('capacity-below-waiting')
    );
    expect(services.updateService('s1', { capacity: 6 }).capacity).toBe(6);
  });

  it('closing keeps everyone already in line', () => {
    const closed = services.setQueueOpen('s1', false);
    expect(closed).toMatchObject({ isOpen: false, waiting: 6, estimatedWait: null });
  });

  it('can only delete a visit type once its line is empty', () => {
    expect(() => services.deleteService('s2')).toThrow(conflictCode('patients-in-line'));
    clearLine('s2');
    services.deleteService('s2');
    expect(() => services.getService('s2')).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('counts a called patient as still in line for delete', () => {
    clearLine('s2');
    addToLine('s2', 'called');
    expect(() => services.deleteService('s2')).toThrow(conflictCode('patients-in-line'));
  });

  it('returns 404 for an unknown visit type', () => {
    for (const call of [
      () => services.getService('nope'),
      () => services.updateService('nope', { capacity: 3 }),
      () => services.setQueueOpen('nope', true),
      () => services.deleteService('nope'),
    ]) {
      expect(call).toThrow(expect.objectContaining({ status: 404, code: 'not-found' }));
    }
  });
});
