/**
 * In-app notifications the Notification component has sent. This belongs
 * to the component, not the Database: the API only reads it to answer
 * GET /notifications/me.
 */
let items = [];
let counter = 0;

export function add(notification) {
  counter += 1;
  const item = { id: `n${counter}`, read: false, createdAt: Date.now(), ...notification };
  items = [item, ...items];
  return { ...item };
}

// Already sent this kind of notification for this check-in?
export function has(entryId, type) {
  return items.some((item) => item.entryId === entryId && item.type === type);
}

export function listForUser(userId) {
  return items.filter((item) => item.userId === userId).map((item) => ({ ...item }));
}

// Returns the updated notification, or null if it is not this user's.
export function markRead(id, userId) {
  const item = items.find((n) => n.id === id && n.userId === userId);
  if (!item) return null;
  item.read = true;
  return { ...item };
}

export function markAllRead(userId) {
  items.forEach((item) => {
    if (item.userId === userId) item.read = true;
  });
}

export function clear() {
  items = [];
  counter = 0;
}
