/**
 * Wait-time model from A1: people ahead x expected visit length, shown as a
 * range (up to 30% longer) because the estimate is genuinely approximate.
 */
export function waitRange(people, minutesEach) {
  const low = people * minutesEach;
  const high = Math.round(low * 1.3);
  return { low, high };
}

// What a patient checking in right now should expect, or null for no wait.
export function estimateWait(service, waiting) {
  if (!service.isOpen || waiting === 0) return null;
  return waitRange(waiting, service.expectedDuration);
}
