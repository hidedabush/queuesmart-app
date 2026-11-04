-- QueueSmart database (A4). MySQL 8.0.16 or newer (CHECK constraints).
-- Run with `npm run db:migrate`; every statement is safe to run again.
-- Times the API returns are milliseconds since 1970 (BIGINT), the same
-- numbers the app already uses. Calendar dates are DATE.

-- 1. UserCredentials: sign-in data only.
CREATE TABLE IF NOT EXISTS user_credentials (
  id VARCHAR(40) NOT NULL,
  email VARCHAR(254) NOT NULL,
  -- scrypt "salt:hash", never the password itself. NULL means the account
  -- cannot sign in (a patient registered at the front desk).
  passwordHash VARCHAR(255) NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_credentials_email UNIQUE (email),
  CONSTRAINT ck_credentials_email CHECK (email LIKE '_%@_%._%')
);

-- 2. UserProfile: who the person is. One profile per credentials row,
-- joined by email.
CREATE TABLE IF NOT EXISTS user_profiles (
  email VARCHAR(254) NOT NULL,
  fullName VARCHAR(80) NOT NULL,
  dob DATE NOT NULL,
  phone CHAR(10) NULL,
  preferences JSON NULL,
  PRIMARY KEY (email),
  CONSTRAINT fk_profiles_credentials FOREIGN KEY (email)
    REFERENCES user_credentials (email) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT ck_profiles_name CHECK (CHAR_LENGTH(fullName) >= 3),
  CONSTRAINT ck_profiles_phone CHECK (phone REGEXP '^[0-9]{10}$')
);

-- 3. Service: the visit types the office offers.
CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(300) NOT NULL,
  expectedDuration INT NOT NULL,
  priority ENUM('low', 'medium', 'high') NOT NULL,
  capacity INT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_services_name UNIQUE (name),
  CONSTRAINT ck_services_name CHECK (CHAR_LENGTH(name) >= 3),
  CONSTRAINT ck_services_duration CHECK (expectedDuration BETWEEN 1 AND 120),
  CONSTRAINT ck_services_capacity CHECK (capacity BETWEEN 1 AND 50)
);

-- 4. Queue: the line for one service. Closing it stops new check-ins only.
CREATE TABLE IF NOT EXISTS queues (
  id VARCHAR(40) NOT NULL,
  serviceId VARCHAR(40) NOT NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_queues_service UNIQUE (serviceId),
  CONSTRAINT fk_queues_service FOREIGN KEY (serviceId)
    REFERENCES services (id) ON DELETE CASCADE
);

-- 5. QueueEntry: one patient's place in a queue. Rows stay after the patient
-- leaves, with how the visit ended in status and the time in leftAt.
CREATE TABLE IF NOT EXISTS queue_entries (
  id VARCHAR(40) NOT NULL,
  queueId VARCHAR(40) NOT NULL,
  userId VARCHAR(40) NOT NULL,
  reason VARCHAR(120) NOT NULL,
  -- Arrival order in the line. Urgent patients are served first, so the
  -- place shown to the patient is worked out from priority + position.
  position INT NOT NULL,
  priority ENUM('normal', 'urgent') NOT NULL DEFAULT 'normal',
  status ENUM('waiting', 'called', 'served', 'no-show', 'canceled', 'removed')
    NOT NULL DEFAULT 'waiting',
  joinedAt BIGINT NOT NULL,
  calledAt BIGINT NULL,
  leftAt BIGINT NULL,
  -- Filled only while the entry is still in line, so the UNIQUE keys below
  -- allow one active check-in per patient and one called patient per queue.
  activeUserId VARCHAR(40) AS (IF(status IN ('waiting', 'called'), userId, NULL)) VIRTUAL,
  calledQueueId VARCHAR(40) AS (IF(status = 'called', queueId, NULL)) VIRTUAL,
  PRIMARY KEY (id),
  CONSTRAINT uq_entries_one_active_per_user UNIQUE (activeUserId),
  CONSTRAINT uq_entries_one_called_per_queue UNIQUE (calledQueueId),
  CONSTRAINT fk_entries_queue FOREIGN KEY (queueId)
    REFERENCES queues (id) ON DELETE CASCADE,
  CONSTRAINT fk_entries_user FOREIGN KEY (userId)
    REFERENCES user_credentials (id) ON DELETE CASCADE,
  CONSTRAINT ck_entries_reason CHECK (CHAR_LENGTH(reason) >= 3),
  CONSTRAINT ck_entries_position CHECK (position >= 1),
  CONSTRAINT ck_entries_left CHECK ((leftAt IS NULL) = (status IN ('waiting', 'called'))),
  INDEX ix_entries_queue_status (queueId, status, position)
);

-- 6a. Notification: messages sent to a patient. Never includes the reason
-- for the visit, because it can show on a lock screen.
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(40) NOT NULL,
  userId VARCHAR(40) NOT NULL,
  title VARCHAR(100) NOT NULL,
  message VARCHAR(255) NOT NULL,
  createdAt BIGINT NOT NULL,
  status ENUM('sent', 'viewed') NOT NULL DEFAULT 'sent',
  PRIMARY KEY (id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (userId)
    REFERENCES user_credentials (id) ON DELETE CASCADE,
  INDEX ix_notifications_user (userId, createdAt)
);

-- 6b. History: one row per finished visit, for the patient's visit history
-- and the admin statistics. serviceName is copied and serviceId has no
-- foreign key, so history survives a visit type being deleted.
CREATE TABLE IF NOT EXISTS visit_history (
  id VARCHAR(40) NOT NULL,
  userId VARCHAR(40) NOT NULL,
  serviceId VARCHAR(40) NOT NULL,
  serviceName VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  joinedAt BIGINT NOT NULL,
  calledAt BIGINT NULL,
  leftAt BIGINT NOT NULL,
  outcome ENUM('seen', 'no-show', 'cancelled', 'removed') NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_history_user FOREIGN KEY (userId)
    REFERENCES user_credentials (id) ON DELETE CASCADE,
  INDEX ix_history_user (userId, leftAt),
  INDEX ix_history_date (date)
);
