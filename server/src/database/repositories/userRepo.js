import { nextId, query, queryOne, transaction } from '../mysql.js';

// user_credentials + user_profiles, read and written as one user:
// { id, email, passwordHash, role, name, dob, phone }.

const SELECT_USER = `
  SELECT c.id, c.email, c.passwordHash, c.role, p.fullName AS name, p.dob, p.phone
  FROM user_credentials c
  JOIN user_profiles p ON p.email = c.email`;

export function findById(id) {
  return queryOne(`${SELECT_USER} WHERE c.id = ?`, [id]);
}

// The column's collation ignores case, so this matches any capitalisation.
export function findByEmail(email) {
  return queryOne(`${SELECT_USER} WHERE c.email = ?`, [email.trim()]);
}

// Both rows or neither.
export async function insert({ name, dob, email, phone = null, passwordHash, role }) {
  const id = nextId('u');

  await transaction(async (run) => {
    await run('INSERT INTO user_credentials SET ?', [{ id, email, passwordHash, role }]);
    await run('INSERT INTO user_profiles SET ?', [{ email, fullName: name, dob, phone }]);
  });

  return { id, name, dob, email, phone, passwordHash, role };
}

export async function setPasswordHash(id, passwordHash) {
  await query('UPDATE user_credentials SET passwordHash = ? WHERE id = ?', [passwordHash, id]);
}
