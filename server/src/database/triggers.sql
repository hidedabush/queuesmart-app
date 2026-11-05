-- QueueSmart triggers: what the database does by itself when a row changes.
-- Run by `npm run db:migrate` after schema.sql. Each trigger is dropped and
-- created again, so a changed rule replaces the old one.
--
-- These back up the rules the API already checks (servicesService.js,
-- queueService.js, staffQueueService.js) so they hold for every writer: the
-- API, the scripts, Workbench, or two requests that race past the service's
-- own check. They never write rows the API writes itself (the history module
-- records visit_history, the notification module records notifications).
--
-- A trigger that refuses a change raises SQLSTATE 45000 with the message
-- "<code>|<text>". The API turns that into the same 409 { error: <code>,
-- message: <text> } the service layer sends for that rule
-- (src/database/signals.js, src/api/middleware/errors.js).
--
-- The DELIMITER lines let this file also run in the mysql client or
-- Workbench; src/database/sqlFile.js reads them the same way.

DELIMITER $$

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

-- T1. A new visit type gets its line straight away, open, with the id
-- setup.queueIdFor() expects. servicesRepo.insert relies on this.
DROP TRIGGER IF EXISTS trg_services_after_insert$$
CREATE TRIGGER trg_services_after_insert
AFTER INSERT ON services
FOR EACH ROW
BEGIN
  INSERT INTO queues (id, serviceId, status)
  VALUES (CONCAT('queue-', NEW.id), NEW.id, 'open');
END$$

-- T2. A visit type keeps its id, and its capacity can never drop below the
-- number of patients already waiting in its line (servicesService.js).
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
-- once nobody is waiting or being called (servicesService.js). Its queue and
-- finished entries then go with it (ON DELETE CASCADE); visit_history keeps
-- its rows.
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

-- T5. Joining a line (queueService.joinQueue): only an open line, and only
-- while fewer people are in it (waiting or called) than its capacity. Rows
-- that arrive already finished (demo data, a dump) are records, not
-- check-ins, so they are let through.
DROP TRIGGER IF EXISTS trg_entries_before_insert$$
CREATE TRIGGER trg_entries_before_insert
BEFORE INSERT ON queue_entries
FOR EACH ROW
BEGIN
  DECLARE queueStatus VARCHAR(10);
  DECLARE lineCapacity INT;
  DECLARE inLineNow INT DEFAULT 0;

  IF NEW.status IN ('waiting', 'called') THEN
    SELECT q.status, s.capacity INTO queueStatus, lineCapacity
    FROM queues q
    JOIN services s ON s.id = q.serviceId
    WHERE q.id = NEW.queueId;

    -- An unknown queueId is left to the foreign key, which names it.
    IF queueStatus = 'closed' THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'closed|This visit type is not accepting new check-ins.';
    END IF;

    SELECT COUNT(*) INTO inLineNow
    FROM queue_entries
    WHERE queueId = NEW.queueId AND status IN ('waiting', 'called');

    IF inLineNow >= lineCapacity THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'full|This visit type has reached its check-in capacity.';
    END IF;
  END IF;
END$$

-- T6. Moving through the line (staffQueueService.js, queueService.leaveLine):
--   waiting -> called -> served | no-show
--   waiting | called -> canceled | removed
-- A finished visit is final, only the called patient can be seen or a
-- no-show, and nobody leaves before they joined. Stamps calledAt and leftAt
-- when a writer leaves them out.
DROP TRIGGER IF EXISTS trg_entries_before_update$$
CREATE TRIGGER trg_entries_before_update
BEFORE UPDATE ON queue_entries
FOR EACH ROW
BEGIN
  IF NEW.queueId <> OLD.queueId OR NEW.id <> OLD.id OR NEW.userId <> OLD.userId THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'entry-locked|A place in line cannot move to another line or patient.';
  END IF;

  IF OLD.status NOT IN ('waiting', 'called') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'visit-finished|This visit already ended and cannot change.';
  END IF;

  IF NEW.status IN ('served', 'no-show') AND OLD.status <> 'called' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'not-called|Only the patient being called can be marked seen or no-show.';
  END IF;

  IF NEW.status = 'called' AND NEW.calledAt IS NULL THEN
    SET NEW.calledAt = ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000);
  END IF;

  IF NEW.status NOT IN ('waiting', 'called') AND NEW.leftAt IS NULL THEN
    SET NEW.leftAt = ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000);
  END IF;

  IF NEW.leftAt IS NOT NULL AND NEW.leftAt < NEW.joinedAt THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'bad-time|A visit cannot end before the patient joined the line.';
  END IF;
END$$

-- ---------------------------------------------------------------------------
-- visit_history
-- ---------------------------------------------------------------------------

-- T7. History is a record of what happened (historyService.recordOutcome
-- adds it): it can be added to, never edited.
DROP TRIGGER IF EXISTS trg_history_before_update$$
CREATE TRIGGER trg_history_before_update
BEFORE UPDATE ON visit_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'history-locked|Visit history cannot be edited.';
END$$

DELIMITER ;
