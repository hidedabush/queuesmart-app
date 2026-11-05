/**
 * Provider office business rules used by service management.
 *
 * QueueSmart runs the walk-in line for a primary-care provider office.
 * schema.sql uses the same numbers for the capacity column's default and
 * CHECK constraint.
 */

// Daily walk-in capacity per visit type. Check-in closes when the line is full.
export const DEFAULT_CAPACITY = 15;
export const MAX_CAPACITY = 50;
