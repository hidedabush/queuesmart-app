/**
 * Provider office business rules used by service management.
 *
 * QueueSmart runs the walk-in line for a primary-care provider office. The
 * check-in, queue and privacy rules belong to the queue module and are added
 * here by that teammate (see the README, section 9).
 */

// Daily walk-in capacity per visit type. Check-in closes when the line is full.
export const DEFAULT_CAPACITY = 15;
export const MAX_CAPACITY = 50;
