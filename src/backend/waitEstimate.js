/**
 * Wait-time model described in A1: people ahead x expected service duration,
 * presented as a range rather than a single number because the estimate is
 * genuinely approximate.
 */
export function waitRange(people, minutesEach) {
  const low = people * minutesEach;
  const high = Math.round(low * 1.3);
  return { low, high };
}

export function estimateWait(service) {
  if (!service.isOpen || service.waiting === 0) return null;
  return waitRange(service.waiting, service.expectedDuration);
}

export function formatWait(service) {
  const estimate = estimateWait(service);
  if (!estimate) return service.isOpen ? 'No wait' : 'Closed';
  return `${estimate.low}–${estimate.high} min`;
}
