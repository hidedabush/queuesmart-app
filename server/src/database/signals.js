/**
 * A trigger in triggers.sql refused a change with
 *   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '<code>|<text>'
 * mysql2 reports that as code ER_SIGNAL_EXCEPTION. This reads it back as
 * { code, message }, or null for any other error.
 */
export const SIGNAL = 'ER_SIGNAL_EXCEPTION';

export function signalOf(error) {
  if (error?.code !== SIGNAL) return null;
  const text = String(error.sqlMessage ?? error.message ?? '');
  const match = /^([a-z][a-z-]*)\|(.+)$/s.exec(text);
  return match ? { code: match[1], message: match[2] } : { code: 'conflict', message: text };
}
