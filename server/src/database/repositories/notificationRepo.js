import { nextId, query, queryOne } from '../mysql.js';

// notifications. The table keeps A4's status ('sent' | 'viewed'); the API
// calls it `read`, so it is renamed here.

const SELECT_NOTIFICATION = `
  SELECT id, userId, entryId, serviceId, type, title, message, channels, createdAt,
         status = 'viewed' AS \`read\`
  FROM notifications`;

// MySQL returns the comparison as 0 or 1, and channels (JSON) as an array.
const toNotification = (row) => row && { ...row, read: Boolean(row.read) };

const toColumns = ({ read, channels, ...fields }) => ({
  ...fields,
  ...(channels !== undefined && { channels: JSON.stringify(channels) }),
  ...(read !== undefined && { status: read ? 'viewed' : 'sent' }),
});

// Newest first. Ids sort in creation order, which breaks ties between
// notifications made in the same millisecond.
export async function listByUser(userId) {
  const rows = await query(`${SELECT_NOTIFICATION} WHERE userId = ? ORDER BY createdAt DESC, id DESC`, [
    userId,
  ]);
  return rows.map(toNotification);
}

export async function findById(id) {
  return toNotification(await queryOne(`${SELECT_NOTIFICATION} WHERE id = ?`, [id]));
}

// Has this patient already been sent this kind of notice for this check-in?
export async function hasForEntry(userId, entryId, type) {
  const row = await queryOne(
    'SELECT 1 AS found FROM notifications WHERE userId = ? AND entryId = ? AND type = ? LIMIT 1',
    [userId, entryId, type]
  );
  return Boolean(row);
}

export async function insert(row) {
  const notification = { ...row, id: nextId('n') };
  await query('INSERT INTO notifications SET ?', [toColumns(notification)]);
  return notification;
}

export async function update(id, patch) {
  await query('UPDATE notifications SET ? WHERE id = ?', [toColumns(patch), id]);
  return findById(id);
}

export async function markAllRead(userId) {
  await query("UPDATE notifications SET status = 'viewed' WHERE userId = ? AND status = 'sent'", [userId]);
}

// Everything sent for one check-in.
export async function markEntryRead(entryId) {
  await query("UPDATE notifications SET status = 'viewed' WHERE entryId = ? AND status = 'sent'", [entryId]);
}
