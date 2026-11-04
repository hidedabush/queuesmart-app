import { describe, expect, it } from 'vitest';
import * as services from '../../src/api/services/servicesService.js';
import { addToLine, clearLine, validService } from '../helpers.js';

const conflictCode = (code) => expect.objectContaining({ status: 409, code });

describe('service management', () => {
  it('lists every visit type with its live line', async () => {
    const list = await services.listServices();
    expect(list).toHaveLength(5);
    const sick = list.find((s) => s.id === 's1');
    expect(sick).toMatchObject({ waiting: 6, hasCalled: false, estimatedWait: { low: 90, high: 117 } });
  });

  it('counts a called patient separately from the waiting ones', async () => {
    addToLine('s3', 'called');
    expect(await services.getService('s3')).toMatchObject({ waiting: 4, hasCalled: true });
  });

  it('creates an open visit type with the default capacity', async () => {
    const { capacity, ...draft } = validService();
    const created = await services.createService(draft);
    expect(created).toMatchObject({ isOpen: true, capacity: 15, waiting: 0, estimatedWait: null });
    expect((await services.getService(created.id)).name).toBe('Allergy Shots');
  });

  it('refuses a duplicate name, ignoring case', async () => {
    await expect(services.createService(validService({ name: 'sick visit' }))).rejects.toThrow(
      conflictCode('name-taken')
    );
  });

  it('updates fields and allows keeping its own name', async () => {
    const updated = await services.updateService('s1', { name: 'Sick Visit', expectedDuration: 20 });
    expect(updated.expectedDuration).toBe(20);
    await expect(services.updateService('s1', { name: 'Lab Work' })).rejects.toThrow(conflictCode('name-taken'));
  });

  it('refuses a capacity below the number already waiting', async () => {
    await expect(services.updateService('s1', { capacity: 5 })).rejects.toThrow(
      conflictCode('capacity-below-waiting')
    );
    expect((await services.updateService('s1', { capacity: 6 })).capacity).toBe(6);
  });

  it('closing keeps everyone already in line', async () => {
    const closed = await services.setQueueOpen('s1', false);
    expect(closed).toMatchObject({ isOpen: false, waiting: 6, estimatedWait: null });
  });

  it('can only delete a visit type once its line is empty', async () => {
    await expect(services.deleteService('s2')).rejects.toThrow(conflictCode('patients-in-line'));
    clearLine('s2');
    await services.deleteService('s2');
    await expect(services.getService('s2')).rejects.toThrow(expect.objectContaining({ status: 404 }));
  });

  it('counts a called patient as still in line for delete', async () => {
    clearLine('s2');
    addToLine('s2', 'called');
    await expect(services.deleteService('s2')).rejects.toThrow(conflictCode('patients-in-line'));
  });

  it('returns 404 for an unknown visit type', async () => {
    for (const call of [
      () => services.getService('nope'),
      () => services.updateService('nope', { capacity: 3 }),
      () => services.setQueueOpen('nope', true),
      () => services.deleteService('nope'),
    ]) {
      await expect(call()).rejects.toThrow(expect.objectContaining({ status: 404, code: 'not-found' }));
    }
  });
});
