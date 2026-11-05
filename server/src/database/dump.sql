-- QueueSmart database dump (Service Management + Admin Dashboard statistics)
-- Made by `npm run db:dump` at 2026-11-05T01:02:52.898Z.
-- Load it with `npm run db:load`, or `mysql -h HOST -P PORT -u USER -p DB < dump.sql`.
-- Loading REPLACES these tables and everything in them:
--   services: 5 rows
--   queues: 5 rows
--   queue_entries: 35 rows
--   visit_history: 17 rows

-- 1. Start clean.
DROP TABLE IF EXISTS `visit_history`;
DROP TABLE IF EXISTS `queue_entries`;
DROP TABLE IF EXISTS `queues`;
DROP TABLE IF EXISTS `services`;

-- 2. Tables (src/database/schema.sql).
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(300) NOT NULL,
  expectedDuration INT NOT NULL,
  priority ENUM('low', 'medium', 'high') NOT NULL,
  capacity INT NOT NULL DEFAULT 15,
  PRIMARY KEY (id),
  CONSTRAINT uq_services_name UNIQUE (name),
  CONSTRAINT ck_services_name CHECK (CHAR_LENGTH(TRIM(name)) >= 3),
  CONSTRAINT ck_services_description CHECK (CHAR_LENGTH(TRIM(description)) >= 1),
  CONSTRAINT ck_services_duration CHECK (expectedDuration BETWEEN 1 AND 120),
  CONSTRAINT ck_services_capacity CHECK (capacity BETWEEN 1 AND 50)
);

CREATE TABLE IF NOT EXISTS queues (
  id VARCHAR(50) NOT NULL,
  serviceId VARCHAR(40) NOT NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_queues_service UNIQUE (serviceId),
  CONSTRAINT fk_queues_service FOREIGN KEY (serviceId)
    REFERENCES services (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS queue_entries (
  id VARCHAR(40) NOT NULL,
  queueId VARCHAR(50) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  priority ENUM('normal', 'urgent') NOT NULL DEFAULT 'normal',
  status ENUM('waiting', 'called', 'served', 'no-show', 'canceled', 'removed')
    NOT NULL DEFAULT 'waiting',
  joinedAt BIGINT NOT NULL DEFAULT 0,
  calledAt BIGINT NULL,
  leftAt BIGINT NULL,
  calledQueueId VARCHAR(50) AS (IF(status = 'called', queueId, NULL)) VIRTUAL,
  PRIMARY KEY (id),
  CONSTRAINT uq_entries_one_called_per_queue UNIQUE (calledQueueId),
  CONSTRAINT fk_entries_queue FOREIGN KEY (queueId)
    REFERENCES queues (id) ON DELETE CASCADE,
  CONSTRAINT ck_entries_left CHECK ((leftAt IS NULL) = (status IN ('waiting', 'called'))),
  CONSTRAINT ck_entries_called CHECK (calledAt IS NULL OR calledAt >= joinedAt),
  INDEX ix_entries_queue_status (queueId, status, position)
);

CREATE TABLE IF NOT EXISTS visit_history (
  id VARCHAR(45) NOT NULL,
  entryId VARCHAR(40) NOT NULL,
  serviceId VARCHAR(40) NOT NULL,
  serviceName VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  joinedAt BIGINT NOT NULL,
  calledAt BIGINT NULL,
  leftAt BIGINT NOT NULL,
  outcome ENUM('seen', 'no-show', 'cancelled', 'removed') NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_history_entry UNIQUE (entryId),
  INDEX ix_history_date (date, serviceId)
);

-- 3. Rows. Loaded before the triggers exist, so they are not run again.
INSERT INTO `services` (`id`, `name`, `description`, `expectedDuration`, `priority`, `capacity`) VALUES
  ('s0mw2ucz6k001db04', 'Sick Visit', 'Fever, cough, sore throat, ear pain, rashes, and other new symptoms.', 15, 'medium', 15),
  ('s0mw2ucz6p0020808', 'Minor Injury', 'Sprains, small cuts, and minor burns that are not an emergency.', 20, 'high', 8),
  ('s0mw2ucz6s003c462', 'Lab Work', 'Blood draws and specimen collection for tests your provider ordered.', 10, 'low', 20),
  ('s0mw2ucz6w004eb11', 'Vaccinations', 'Flu shots, boosters, and routine immunizations.', 5, 'low', 20),
  ('s0mw2ucz700051dc6', 'Prescription Refill', 'A quick provider review to renew a medication you already take.', 10, 'low', 10);

INSERT INTO `queues` (`id`, `serviceId`, `status`) VALUES
  ('queue-s0mw2ucz6k001db04', 's0mw2ucz6k001db04', 'open'),
  ('queue-s0mw2ucz6p0020808', 's0mw2ucz6p0020808', 'open'),
  ('queue-s0mw2ucz6s003c462', 's0mw2ucz6s003c462', 'open'),
  ('queue-s0mw2ucz6w004eb11', 's0mw2ucz6w004eb11', 'open'),
  ('queue-s0mw2ucz700051dc6', 's0mw2ucz700051dc6', 'closed');

INSERT INTO `queue_entries` (`id`, `queueId`, `position`, `priority`, `status`, `joinedAt`, `calledAt`, `leftAt`) VALUES
  ('q0mw2ucz760068056', 'queue-s0mw2ucz6k001db04', 1, 'normal', 'canceled', 1793837023157, NULL, 1793838103157),
  ('q0mw2ucz7f007f11f', 'queue-s0mw2ucz6k001db04', 2, 'normal', 'served', 1793837384818, 1793838104818, 1793839004818),
  ('q0mw2ucz7p0088d0b', 'queue-s0mw2ucz6k001db04', 3, 'normal', 'canceled', 1793838106588, NULL, 1793838886588),
  ('q0mw2ucz7v0099394', 'queue-s0mw2ucz6k001db04', 4, 'normal', 'canceled', 1793838417800, NULL, 1793839617800),
  ('q0mw2ucz8100aec7b', 'queue-s0mw2ucz6k001db04', 5, 'normal', 'served', 1793838944009, 1793840144009, 1793840570184),
  ('q0mw2ucz8900b8d13', 'queue-s0mw2ucz6k001db04', 6, 'urgent', 'called', 1793839970184, 1793840571957, NULL),
  ('q0mw2ucz8d00c5d26', 'queue-s0mw2ucz6k001db04', 7, 'normal', 'waiting', 1793840270184, NULL, NULL),
  ('q0mw2ucz8g00d2144', 'queue-s0mw2ucz6k001db04', 8, 'normal', 'waiting', 1793840570184, NULL, NULL),
  ('q0mw2ucz8j00e5f48', 'queue-s0mw2ucz6p0020808', 1, 'normal', 'served', 1793837291428, 1793838011428, 1793839211428),
  ('q0mw2ucz8s00f9430', 'queue-s0mw2ucz6p0020808', 2, 'normal', 'served', 1793837680918, 1793839420918, 1793840570184),
  ('q0mw2ucz9100ge44b', 'queue-s0mw2ucz6p0020808', 3, 'normal', 'served', 1793838899319, 1793839439319, 1793840570184),
  ('q0mw2ucz9a00h058e', 'queue-s0mw2ucz6p0020808', 4, 'normal', 'canceled', 1793839850184, NULL, 1793840571846),
  ('q0mw2ucz9c00i6293', 'queue-s0mw2ucz6p0020808', 5, 'normal', 'called', 1793840090184, 1793840572389, NULL),
  ('q0mw2ucz9f00j6894', 'queue-s0mw2ucz6p0020808', 6, 'normal', 'waiting', 1793840330184, NULL, NULL),
  ('q0mw2ucz9i00kca16', 'queue-s0mw2ucz6p0020808', 7, 'urgent', 'served', 1793840570184, 1793840571644, 1793840572200),
  ('q0mw2ucz9l00l4e45', 'queue-s0mw2ucz6s003c462', 1, 'normal', 'served', 1793837261789, 1793837921789, 1793838521789),
  ('q0mw2ucz9u00m6b25', 'queue-s0mw2ucz6s003c462', 2, 'normal', 'served', 1793838165368, 1793838945368, 1793839545368),
  ('q0mw2ucza200n573e', 'queue-s0mw2ucz6s003c462', 3, 'normal', 'canceled', 1793839072126, NULL, 1793839912126),
  ('q0mw2ucza800o9c0b', 'queue-s0mw2ucz6s003c462', 4, 'normal', 'called', 1793840570184, 1793840572512, NULL),
  ('q0mw2uczab00pc195', 'queue-s0mw2ucz6w004eb11', 1, 'normal', 'served', 1793837347460, 1793838907460, 1793839207460),
  ('q0mw2uczan00q5942', 'queue-s0mw2ucz6w004eb11', 2, 'normal', 'served', 1793838399453, 1793840439453, 1793840570184),
  ('q0mw2uczax00r3907', 'queue-s0mw2ucz6w004eb11', 3, 'normal', 'removed', 1793838817019, NULL, 1793839177019),
  ('q0mw2uczb300s55a6', 'queue-s0mw2ucz6w004eb11', 4, 'normal', 'canceled', 1793840570184, NULL, 1793840571783),
  ('q0mw2uczhq0010319', 'queue-s0mw2ucz6k001db04', 9, 'normal', 'waiting', 1793840571570, NULL, NULL),
  ('q0mw2uczlx00252c1', 'queue-s0mw2ucz6s003c462', 5, 'normal', 'waiting', 1793840571721, NULL, NULL),
  ('q0mw2uczqx0030305', 'queue-s0mw2ucz6p0020808', 8, 'normal', 'waiting', 1793840571901, NULL, NULL),
  ('q0mw2uczu700495fd', 'queue-s0mw2ucz6w004eb11', 5, 'normal', 'waiting', 1793840572019, NULL, NULL),
  ('q0mw2uczvs0053718', 'queue-s0mw2ucz6s003c462', 6, 'normal', 'waiting', 1793840572075, NULL, NULL),
  ('q0mw2uczxa006bbe8', 'queue-s0mw2ucz6w004eb11', 6, 'urgent', 'called', 1793840572130, 1793840572262, NULL),
  ('q0mw2ud02w0070d27', 'queue-s0mw2ucz6p0020808', 9, 'normal', 'waiting', 1793840572332, NULL, NULL),
  ('q0mw2ud06600869f0', 'queue-s0mw2ucz6k001db04', 10, 'normal', 'waiting', 1793840572449, NULL, NULL),
  ('q0mw2ud09g009c163', 'queue-s0mw2ucz6s003c462', 7, 'normal', 'waiting', 1793840572568, NULL, NULL),
  ('q0mw2ud0b000a9575', 'queue-s0mw2ucz6s003c462', 8, 'normal', 'waiting', 1793840572623, NULL, NULL),
  ('q0mw2ud0cj00bb1e1', 'queue-s0mw2ucz6s003c462', 9, 'normal', 'waiting', 1793840572679, NULL, NULL),
  ('q0mw2ud0e300cc41f', 'queue-s0mw2ucz6s003c462', 10, 'normal', 'waiting', 1793840572734, NULL, NULL);

INSERT INTO `visit_history` (`id`, `entryId`, `serviceId`, `serviceName`, `date`, `joinedAt`, `calledAt`, `leftAt`, `outcome`) VALUES
  ('h-q0mw2ucz760068056', 'q0mw2ucz760068056', 's0mw2ucz6k001db04', 'Sick Visit', '2026-11-05', 1793837023157, NULL, 1793838103157, 'cancelled'),
  ('h-q0mw2ucz7f007f11f', 'q0mw2ucz7f007f11f', 's0mw2ucz6k001db04', 'Sick Visit', '2026-11-05', 1793837384818, 1793838104818, 1793839004818, 'seen'),
  ('h-q0mw2ucz7p0088d0b', 'q0mw2ucz7p0088d0b', 's0mw2ucz6k001db04', 'Sick Visit', '2026-11-05', 1793838106588, NULL, 1793838886588, 'cancelled'),
  ('h-q0mw2ucz7v0099394', 'q0mw2ucz7v0099394', 's0mw2ucz6k001db04', 'Sick Visit', '2026-11-05', 1793838417800, NULL, 1793839617800, 'cancelled'),
  ('h-q0mw2ucz8100aec7b', 'q0mw2ucz8100aec7b', 's0mw2ucz6k001db04', 'Sick Visit', '2026-11-05', 1793838944009, 1793840144009, 1793840570184, 'seen'),
  ('h-q0mw2ucz8j00e5f48', 'q0mw2ucz8j00e5f48', 's0mw2ucz6p0020808', 'Minor Injury', '2026-11-05', 1793837291428, 1793838011428, 1793839211428, 'seen'),
  ('h-q0mw2ucz8s00f9430', 'q0mw2ucz8s00f9430', 's0mw2ucz6p0020808', 'Minor Injury', '2026-11-05', 1793837680918, 1793839420918, 1793840570184, 'seen'),
  ('h-q0mw2ucz9100ge44b', 'q0mw2ucz9100ge44b', 's0mw2ucz6p0020808', 'Minor Injury', '2026-11-05', 1793838899319, 1793839439319, 1793840570184, 'seen'),
  ('h-q0mw2ucz9a00h058e', 'q0mw2ucz9a00h058e', 's0mw2ucz6p0020808', 'Minor Injury', '2026-11-05', 1793839850184, NULL, 1793840571846, 'cancelled'),
  ('h-q0mw2ucz9i00kca16', 'q0mw2ucz9i00kca16', 's0mw2ucz6p0020808', 'Minor Injury', '2026-11-05', 1793840570184, 1793840571644, 1793840572200, 'seen'),
  ('h-q0mw2ucz9l00l4e45', 'q0mw2ucz9l00l4e45', 's0mw2ucz6s003c462', 'Lab Work', '2026-11-05', 1793837261789, 1793837921789, 1793838521789, 'seen'),
  ('h-q0mw2ucz9u00m6b25', 'q0mw2ucz9u00m6b25', 's0mw2ucz6s003c462', 'Lab Work', '2026-11-05', 1793838165368, 1793838945368, 1793839545368, 'seen'),
  ('h-q0mw2ucza200n573e', 'q0mw2ucza200n573e', 's0mw2ucz6s003c462', 'Lab Work', '2026-11-05', 1793839072126, NULL, 1793839912126, 'cancelled'),
  ('h-q0mw2uczab00pc195', 'q0mw2uczab00pc195', 's0mw2ucz6w004eb11', 'Vaccinations', '2026-11-05', 1793837347460, 1793838907460, 1793839207460, 'seen'),
  ('h-q0mw2uczan00q5942', 'q0mw2uczan00q5942', 's0mw2ucz6w004eb11', 'Vaccinations', '2026-11-05', 1793838399453, 1793840439453, 1793840570184, 'seen'),
  ('h-q0mw2uczax00r3907', 'q0mw2uczax00r3907', 's0mw2ucz6w004eb11', 'Vaccinations', '2026-11-05', 1793838817019, NULL, 1793839177019, 'removed'),
  ('h-q0mw2uczb300s55a6', 'q0mw2uczb300s55a6', 's0mw2ucz6w004eb11', 'Vaccinations', '2026-11-05', 1793840570184, NULL, 1793840571783, 'cancelled');

-- 4. Triggers (src/database/triggers.sql).
DELIMITER $$
DROP TRIGGER IF EXISTS trg_services_after_insert$$

CREATE TRIGGER trg_services_after_insert
AFTER INSERT ON services
FOR EACH ROW
BEGIN
  INSERT INTO queues (id, serviceId, status)
  VALUES (CONCAT('queue-', NEW.id), NEW.id, 'open');
END$$

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

DROP TRIGGER IF EXISTS trg_history_before_update$$

CREATE TRIGGER trg_history_before_update
BEFORE UPDATE ON visit_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'history-locked|Visit history cannot be edited.';
END$$

DELIMITER ;
