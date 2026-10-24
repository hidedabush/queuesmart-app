import { request } from './client';

/**
 * History API (docs/A3-api-spec.txt section 7). The history screen reads
 * the result through ServicesStore.
 */

// GET /history/me
export async function listMine() {
  return (await request('GET', '/history/me')).history;
}