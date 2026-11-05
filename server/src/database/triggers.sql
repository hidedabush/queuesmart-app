-- QueueSmart triggers: what the database does by itself when a row changes.
-- Run by `npm run db:migrate` after schema.sql. Each trigger is dropped and
-- created again, so a changed rule replaces the old one.
--
-- A trigger that refuses a change raises SQLSTATE 45000 with the message
-- "<code>|<text>". The API turns that into the same 409 { error: <code>,
-- message: <text> } the service layer sends for that rule
-- (src/database/signals.js, src/api/middleware/errors.js), so a request that
-- races past the service's own check still gets the usual answer.
--
-- The DELIMITER lines let this file also run in the mysql client or
-- Workbench; src/database/sqlFile.js reads them the same way.

DELIMITER $$

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

-- T1. A new visit type gets its line straight away, open.
DROP TRIGGER IF EXISTS trg_services_after_insert$$
CREATE TRIGGER trg_services_after_insert
AFTER INSERT ON services
FOR EACH ROW
BEGIN
  INSERT INTO queues (id, serviceId, status)
  VALUES (CONCAT('queue-', NEW.id), NEW.id, 'open');
END$$

-- T2. A visit type keeps its id, and its capacity can never drop below the
-- number of patients already waiting in its line.
DROP TRIGGER IF EXISTS trg_services_before_update$$
CREATE TRIGGER trg_services_before_update
BEFORE UPDATE ON services
FOR EACH ROW
BEGIN
  DECLARE waitingNow INT DEFAULT 0;
  DECLARE msg VARCHAR(128);

  IF NEW.id <> OLD.id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'id-locked|A visit type id cannot change.';
  END IF;

  IF NEW.capacity < OLD.capacity THEN
    SELECT COUNT(*) INTO waitingNow
    FROM queue_entries e
    JOIN queues q ON q.id = e.queueId
    WHERE q.serviceId = NEW.id AND e.status = 'waiting';

    IF NEW.capacity < waitingNow THEN
      SET msg = CONCAT('capacity-below-waiting|', waitingNow,
        ' patients are already in line. Capacity cannot be lower than that.');
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = msg;
    END IF;
  END IF;
END$$

-- T3. Patients are never dropped silently: a visit type can only be deleted
-- once nobody is waiting or being called. Its queue and finished entries
-- then go with it (ON DELETE CASCADE); visit_history keeps its rows.
DROP TRIGGER IF EXISTS trg_services_before_delete$$
CREATE TRIGGER trg_services_before_delete
BEFORE DELETE ON services
FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1
    FROM queue_entries e
    JOIN queues q ON q.id = e.queueId
    WHERE q.serviceId = OLD.id AND e.status IN ('waiting', 'called')
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'patients-in-line|Patients are still in this line. Close it and let it clear first.';
  END IF;
END$$

-- ---------------------------------------------------------------------------
-- queues
-- ---------------------------------------------------------------------------

-- T4. A queue always belongs to the service it was made for.
DROP TRIGGER IF EXISTS trg_queues_before_update$$
CREATE TRIGGER trg_queues_before_update
BEFORE UPDATE ON queues
FOR EACH ROW
BEGIN
  IF NEW.serviceId <> OLD.serviceId OR NEW.id <> OLD.id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'queue-locked|A queue cannot move to another visit type.';
  END IF;
END$$

-- ---------------------------------------------------------------------------
-- queue_entries
-- ---------------------------------------------------------------------------

-- T5. Joining a line: only into an open line that still has room, and only
-- as waiting (or straight to called). Fills in the arrival time and the next
-- position when they are left out.
DROP TRIGGER IF EXISTS trg_entries_before_insert$$
CREATE TRIGGER trg_entries_before_insert
BEFORE INSERT ON queue_entries
FOR EACH ROW
BEGIN
  DECLARE queueStatus VARCHAR(10);
  DECLARE lineCapacity INT;
  DECLARE waitingNow INT DEFAULT 0;
  DECLARE nextPosition INT DEFAULT 1;

  IF NEW.status NOT IN ('waiting', 'called') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'not-in-line|A new entry starts as waiting or called; finish it with an update.';
  END IF;

  SELECT q.status, s.capacity INTO queueStatus, lineCapacity
  FROM queues q
  JOIN services s ON s.id = q.serviceId
  WHERE q.id = NEW.queueId;

  -- An unknown queueId is left to the foreign key, which names it.
  IF queueStatus = 'closed' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'closed|This line is closed to new check-ins.';
  END IF;

  IF NEW.status = 'waiting' THEN
    SELECT COUNT(*) INTO waitingNow
    FROM queue_entries
    WHERE queueId = NEW.queueId AND status = 'waiting';

    IF waitingNow >= lineCapacity THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'full|This line is full for today.';
    END IF;
  END IF;

  IF NEW.joinedAt = 0 THEN
    SET NEW.joinedAt = ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000);
  END IF;

  IF NEW.position < 1 THEN
    SELECT COALESCE(MAX(position), 0) + 1 INTO nextPosition
    FROM queue_entries
    WHERE queueId = NEW.queueId;
    SET NEW.position = nextPosition;
  END IF;

  IF NEW.status = 'called' AND NEW.calledAt IS NULL THEN
    SET NEW.calledAt = ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000);
  END IF;
END$$

-- T6. Moving through the line: waiting -> called -> served | no-show, or
-- waiting/called -> canceled | removed. A finished visit is final, and only
-- the called patient can be marked served or no-show. Stamps calledAt and
-- leftAt when they are left out.
DROP TRIGGER IF EXISTS trg_entries_before_update$$
CREATE TRIGGER trg_entries_before_update
BEFORE UPDATE ON queue_entries
FOR EACH ROW
BEGIN
  IF NEW.queueId <> OLD.queueId OR NEW.id <> OLD.id THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'entry-locked|A place in line cannot move to another line.';
  END IF;

  IF OLD.status NOT IN ('waiting', 'called') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'visit-finished|This visit already ended and cannot change.';
  END IF;

  IF NEW.status IN ('served', 'no-show') AND OLD.status <> 'called' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'not-called|Only the patient being called can be marked seen or no-show.';
  END IF;

  IF NEW.status = 'called' AND OLD.status = 'waiting' AND NEW.calledAt IS NULL THEN
    SET NEW.calledAt = ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000);
  END IF;

  -- Sent back to waiting: no longer being called.
  IF NEW.status = 'waiting' AND OLD.status = 'called' THEN
    SET NEW.calledAt = NULL;
  END IF;

  IF NEW.status NOT IN ('waiting', 'called') AND NEW.leftAt IS NULL THEN
    SET NEW.leftAt = ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000);
  END IF;

  IF NEW.leftAt IS NOT NULL AND NEW.leftAt < NEW.joinedAt THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bad-time|A visit cannot end before the patient joined the line.';
  END IF;
END$$

-- T7. A visit leaving the line writes its history row, which the admin
-- dashboard's statistics read (served, no-show, cancelled, removed counts and
-- the average wait). The date is the UTC day the visit ended.
DROP TRIGGER IF EXISTS trg_entries_after_update$$
CREATE TRIGGER trg_entries_after_update
AFTER UPDATE ON queue_entries
FOR EACH ROW
BEGIN
  IF OLD.status IN ('waiting', 'called') AND NEW.status NOT IN ('waiting', 'called') THEN
    INSERT INTO visit_history
      (id, entryId, serviceId, serviceName, date, joinedAt, calledAt, leftAt, outcome)
    SELECT
      CONCAT('h-', NEW.id),
      NEW.id,
      s.id,
      s.name,
      DATE(TIMESTAMP('1970-01-01') + INTERVAL FLOOR(NEW.leftAt / 1000) SECOND),
      NEW.joinedAt,
      NEW.calledAt,
      NEW.leftAt,
      CASE NEW.status
        WHEN 'served' THEN 'seen'
        WHEN 'canceled' THEN 'cancelled'
        ELSE NEW.status
      END
    FROM queues q
    JOIN services s ON s.id = q.serviceId
    WHERE q.id = NEW.queueId;
  END IF;
END$$

-- ---------------------------------------------------------------------------
-- visit_history
-- ---------------------------------------------------------------------------

-- T8. History is a record of what happened: it can be added to, never edited.
DROP TRIGGER IF EXISTS trg_history_before_update$$
CREATE TRIGGER trg_history_before_update
BEFORE UPDATE ON visit_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'history-locked|Visit history cannot be edited.';
END$$

DELIMITER ;
