-- QueueSmart database: Service Management + Admin Dashboard statistics.
-- MySQL 8.0.16 or newer (CHECK constraints).
--
-- Run with `npm run db:migrate`; every statement is safe to run again. The
-- rules that fire when a row changes are in triggers.sql, which migrate runs
-- straight after this file.
--
-- Times the API returns are milliseconds since 1970 (BIGINT), the same
-- numbers the app already uses. Calendar dates are DATE (UTC).

-- 1. Service: the visit types the office offers.
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

-- 2. Queue: the line for one service. A trigger creates it together with
-- its service. Closing it stops new check-ins only.
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

-- 3. QueueEntry: one place in a line. Service management reads it for the
-- waiting count, "someone is being called", the wait estimate and the
-- delete/capacity rules. Rows stay after the visit ends, with how it ended
-- in status and the time in leftAt.
CREATE TABLE IF NOT EXISTS queue_entries (
  id VARCHAR(40) NOT NULL,
  queueId VARCHAR(50) NOT NULL,
  -- Arrival order in the line. Leave it out (0) and a trigger gives the
  -- next number.
  position INT NOT NULL DEFAULT 0,
  priority ENUM('normal', 'urgent') NOT 
  NULL DEFAULT 'normal',
  status ENUM('waiting', 'called', 'served', 'no-show', 'canceled', 'removed')
    NOT NULL DEFAULT 'waiting',
  -- Leave joinedAt out (0) and a trigger stamps the current time.
  joinedAt BIGINT NOT NULL DEFAULT 0,
  calledAt BIGINT NULL,
  leftAt BIGINT NULL,
  -- Filled only while the entry is being called, so the UNIQUE key below
  -- allows one called patient per queue even if two requests race.
  calledQueueId VARCHAR(50) AS (IF(status = 'called', queueId, NULL)) VIRTUAL,
  PRIMARY KEY (id),
  CONSTRAINT uq_entries_one_called_per_queue UNIQUE (calledQueueId),
  CONSTRAINT fk_entries_queue FOREIGN KEY (queueId)
    REFERENCES queues (id) ON DELETE CASCADE,
  CONSTRAINT ck_entries_left CHECK ((leftAt IS NULL) = (status IN ('waiting', 'called'))),
  CONSTRAINT ck_entries_called CHECK (calledAt IS NULL OR calledAt >= joinedAt),
  INDEX ix_entries_queue_status (queueId, status, position)
);

-- 4. History: one row per finished visit, written by a trigger when an entry
-- leaves the line. The admin dashboard's statistics read it. serviceName is
-- copied and serviceId has no foreign key, so a day's numbers survive a
-- visit type being deleted. A trigger blocks edits.
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
