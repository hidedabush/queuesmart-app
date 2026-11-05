import { readFileSync } from 'node:fs';

/**
 * Splits a .sql file into statements the way the mysql client does, so the
 * same files run from here, from `mysql < file.sql` and from Workbench:
 *   - `DELIMITER $$` changes what ends a statement (needed for trigger
 *     bodies, which contain `;`), until the next DELIMITER line
 *   - lines that are only a `--` comment, and blank lines, are skipped
 */
export function splitSql(text) {
  const statements = [];
  let delimiter = ';';
  let current = [];

  const flush = () => {
    const statement = current.join('\n').trim();
    if (statement) statements.push(statement);
    current = [];
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const directive = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line);

    if (directive) {
      flush();
      delimiter = directive[1];
    } else if (line.trim() !== '' && !/^\s*--/.test(line)) {
      if (line.endsWith(delimiter)) {
        current.push(line.slice(0, -delimiter.length));
        flush();
      } else {
        current.push(line);
      }
    }
  }

  flush();
  return statements;
}

// A .sql file next to this one, already split.
export function readSqlFile(name) {
  return splitSql(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));
}
