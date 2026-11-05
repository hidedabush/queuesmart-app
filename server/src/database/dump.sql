-- QueueSmart database dump
-- Made by `npm run db:dump` at 2026-11-05T19:41:02.731Z.
-- Load it with `npm run db:load`, or `mysql -h HOST -P PORT -u USER -p DB < dump.sql`.
-- Loading REPLACES these tables and everything in them:
--   user_credentials: 94 rows
--   user_profiles: 94 rows
--   services: 5 rows
--   queues: 5 rows
--   queue_entries: 92 rows
--   notifications: 135 rows
--   visit_history: 54 rows

-- 1. Start clean.
DROP TABLE IF EXISTS `visit_history`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `queue_entries`;
DROP TABLE IF EXISTS `queues`;
DROP TABLE IF EXISTS `services`;
DROP TABLE IF EXISTS `user_profiles`;
DROP TABLE IF EXISTS `user_credentials`;

-- 2. Tables (src/database/schema.sql).
CREATE TABLE IF NOT EXISTS user_credentials (
  id VARCHAR(40) NOT NULL,
  email VARCHAR(254) NOT NULL,
  passwordHash VARCHAR(255) NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_credentials_email UNIQUE (email),
  CONSTRAINT ck_credentials_email CHECK (email LIKE '_%@_%._%')
);

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

CREATE TABLE IF NOT EXISTS queue_entries (
  id VARCHAR(40) NOT NULL,
  queueId VARCHAR(40) NOT NULL,
  userId VARCHAR(40) NOT NULL,
  reason VARCHAR(120) NOT NULL,
  position INT NOT NULL,
  priority ENUM('normal', 'urgent') NOT NULL DEFAULT 'normal',
  status ENUM('waiting', 'called', 'served', 'no-show', 'canceled', 'removed')
    NOT NULL DEFAULT 'waiting',
  joinedAt BIGINT NOT NULL,
  calledAt BIGINT NULL,
  leftAt BIGINT NULL,
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

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(40) NOT NULL,
  userId VARCHAR(40) NOT NULL,
  entryId VARCHAR(40) NOT NULL,
  serviceId VARCHAR(40) NOT NULL,
  type ENUM('joined', 'almost-up', 'called') NOT NULL,
  title VARCHAR(100) NOT NULL,
  message VARCHAR(255) NOT NULL,
  channels JSON NOT NULL,
  createdAt BIGINT NOT NULL,
  status ENUM('sent', 'viewed') NOT NULL DEFAULT 'sent',
  PRIMARY KEY (id),
  CONSTRAINT fk_notifications_user FOREIGN KEY (userId)
    REFERENCES user_credentials (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_entry FOREIGN KEY (entryId)
    REFERENCES queue_entries (id) ON DELETE CASCADE,
  INDEX ix_notifications_user (userId, createdAt),
  INDEX ix_notifications_entry (entryId, type)
);

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

-- 3. Rows. Loaded before the triggers exist, so they are not run again.
INSERT INTO `user_credentials` (`id`, `email`, `passwordHash`, `role`) VALUES
  ('u-admin', 'admin@queuesmart.test', 'queuesmart-admin-seed:5cfb603bc7ff51b649dcb678b2a0d4776461b51756fd0352fb4646a129d9ec3820a067ce2d3e517cdbb463f2a369944a3f5fe7507084fd49ee139061a5b46b39', 'admin'),
  ('u-mock-mw3yawwt1ln-1', 'mock-mw3yawwt1ln-1@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-10', 'mock-mw3yawwt1ln-10@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-11', 'mock-mw3yawwt1ln-11@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-12', 'mock-mw3yawwt1ln-12@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-13', 'mock-mw3yawwt1ln-13@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-14', 'mock-mw3yawwt1ln-14@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-15', 'mock-mw3yawwt1ln-15@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-16', 'mock-mw3yawwt1ln-16@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-17', 'mock-mw3yawwt1ln-17@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-2', 'mock-mw3yawwt1ln-2@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-3', 'mock-mw3yawwt1ln-3@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-4', 'mock-mw3yawwt1ln-4@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-5', 'mock-mw3yawwt1ln-5@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-6', 'mock-mw3yawwt1ln-6@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-7', 'mock-mw3yawwt1ln-7@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-8', 'mock-mw3yawwt1ln-8@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yawwt1ln-9', 'mock-mw3yawwt1ln-9@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-1', 'mock-mw3yax881zz-1@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-10', 'mock-mw3yax881zz-10@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-11', 'mock-mw3yax881zz-11@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-12', 'mock-mw3yax881zz-12@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-13', 'mock-mw3yax881zz-13@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-14', 'mock-mw3yax881zz-14@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-15', 'mock-mw3yax881zz-15@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-16', 'mock-mw3yax881zz-16@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-17', 'mock-mw3yax881zz-17@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-18', 'mock-mw3yax881zz-18@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-19', 'mock-mw3yax881zz-19@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-2', 'mock-mw3yax881zz-2@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-3', 'mock-mw3yax881zz-3@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-4', 'mock-mw3yax881zz-4@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-5', 'mock-mw3yax881zz-5@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-6', 'mock-mw3yax881zz-6@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-7', 'mock-mw3yax881zz-7@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-8', 'mock-mw3yax881zz-8@queuesmart.test', NULL, 'user'),
  ('u-mock-mw3yax881zz-9', 'mock-mw3yax881zz-9@queuesmart.test', NULL, 'user'),
  ('u-patient', 'patient@queuesmart.test', 'queuesmart-patient-seed:38d97eb1b2ba7237b783ebdb8c6b1c338a8313c8f83d8cb2945623534b4d3fbbd6b512584e3d071539d712afb9687957d2ee7ef4b0fcae4f3599738de21e07b6', 'user'),
  ('u-sample-1', 'sample-patient-1@queuesmart.test', NULL, 'user'),
  ('u-sample-2', 'sample-patient-2@queuesmart.test', NULL, 'user'),
  ('u-sample-3', 'sample-patient-3@queuesmart.test', NULL, 'user'),
  ('u-sample-4', 'sample-patient-4@queuesmart.test', NULL, 'user'),
  ('u-sample-5', 'sample-patient-5@queuesmart.test', NULL, 'user'),
  ('u-sample-6', 'sample-patient-6@queuesmart.test', NULL, 'user'),
  ('u-sample-7', 'sample-patient-7@queuesmart.test', NULL, 'user'),
  ('u-sample-8', 'sample-patient-8@queuesmart.test', NULL, 'user'),
  ('u-seed-1', 'seed-patient-1@queuesmart.test', NULL, 'user'),
  ('u-seed-10', 'seed-patient-10@queuesmart.test', NULL, 'user'),
  ('u-seed-11', 'seed-patient-11@queuesmart.test', NULL, 'user'),
  ('u-seed-12', 'seed-patient-12@queuesmart.test', NULL, 'user'),
  ('u-seed-13', 'seed-patient-13@queuesmart.test', NULL, 'user'),
  ('u-seed-14', 'seed-patient-14@queuesmart.test', NULL, 'user'),
  ('u-seed-15', 'seed-patient-15@queuesmart.test', NULL, 'user'),
  ('u-seed-2', 'seed-patient-2@queuesmart.test', NULL, 'user'),
  ('u-seed-3', 'seed-patient-3@queuesmart.test', NULL, 'user'),
  ('u-seed-4', 'seed-patient-4@queuesmart.test', NULL, 'user'),
  ('u-seed-5', 'seed-patient-5@queuesmart.test', NULL, 'user'),
  ('u-seed-6', 'seed-patient-6@queuesmart.test', NULL, 'user'),
  ('u-seed-7', 'seed-patient-7@queuesmart.test', NULL, 'user'),
  ('u-seed-8', 'seed-patient-8@queuesmart.test', NULL, 'user'),
  ('u-seed-9', 'seed-patient-9@queuesmart.test', NULL, 'user'),
  ('u0mw3yawx2001c986', 'mock-mw3yawx22g3@queuesmart.test', NULL, 'user'),
  ('u0mw3yawxp007a312', 'mock-mw3yawxp3d6@queuesmart.test', NULL, 'user'),
  ('u0mw3yawy400a4df4', 'mock-mw3yawy4458@queuesmart.test', NULL, 'user'),
  ('u0mw3yawyp00g772e', 'mock-mw3yawyp5s9@queuesmart.test', NULL, 'user'),
  ('u0mw3yawz300j2fca', 'mock-mw3yawz36b2@queuesmart.test', NULL, 'user'),
  ('u0mw3yawzh00m5875', 'mock-mw3yawzh75c@queuesmart.test', NULL, 'user'),
  ('u0mw3yax0200s3d23', 'mock-mw3yax02889@queuesmart.test', NULL, 'user'),
  ('u0mw3yax0o00ya97b', 'mock-mw3yax0o9sz@queuesmart.test', NULL, 'user'),
  ('u0mw3yax8l0012a4c', 'mock-mw3yax8l2v8@queuesmart.test', NULL, 'user'),
  ('u0mw3yax91004fcaf', 'mock-mw3yax913ba@queuesmart.test', NULL, 'user'),
  ('u0mw3yax9f0074bbe', 'mock-mw3yax9f4d7@queuesmart.test', NULL, 'user'),
  ('u0mw3yax9u00a53ae', 'mock-mw3yax9u52v@queuesmart.test', NULL, 'user'),
  ('u0mw3yaxa800ddbd0', 'mock-mw3yaxa86g2@queuesmart.test', NULL, 'user'),
  ('u0mw3yaxal00g1e8b', 'mock-mw3yaxal7bb@queuesmart.test', NULL, 'user'),
  ('u0mw3yaxay00jf9e8', 'mock-mw3yaxay8rj@queuesmart.test', NULL, 'user'),
  ('u0mw3yaxjo001ee6b', 'mock-mw3yaxjo1p5@queuesmart.test', NULL, 'user'),
  ('u0mw3yaxq80080a26', 'mock-mw3yaxq726v@queuesmart.test', NULL, 'user'),
  ('u0mw3yaxs600b009a', 'mock-mw3yaxs63mh@queuesmart.test', NULL, 'user'),
  ('u0mw3yaxw500gd1da', 'mock-mw3yaxw54os@queuesmart.test', NULL, 'user'),
  ('u0mw3yaxy700j9895', 'mock-mw3yaxy75x6@queuesmart.test', NULL, 'user'),
  ('u0mw3yay1t00md538', 'mock-mw3yay1t67@queuesmart.test', NULL, 'user'),
  ('u0mw3yay4400p0d7d', 'mock-mw3yay447ql@queuesmart.test', NULL, 'user'),
  ('u0mw3yay6900s517d', 'mock-mw3yay698le@queuesmart.test', NULL, 'user'),
  ('u0mw3yay8g00v027e', 'mock-mw3yay8g9i8@queuesmart.test', NULL, 'user'),
  ('u0mw3yayao00y2c67', 'mock-mw3yayaoaqi@queuesmart.test', NULL, 'user'),
  ('u0mw3yayie0164db0', 'mock-mw3yayieb25@queuesmart.test', NULL, 'user'),
  ('u0mw3yaykb0195dc1', 'mock-mw3yaykbceu@queuesmart.test', NULL, 'user'),
  ('u0mw3yayq801f9590', 'mock-mw3yayq8dju@queuesmart.test', NULL, 'user'),
  ('u0mw3yays601i907f', 'mock-mw3yays6exi@queuesmart.test', NULL, 'user'),
  ('u0mw3yayu501l46ca', 'mock-mw3yayu5fqc@queuesmart.test', NULL, 'user'),
  ('u0mw3yaz0b01s7e3f', 'mock-mw3yaz0bgq4@queuesmart.test', NULL, 'user'),
  ('u0mw3yaz2801v377e', 'mock-mw3yaz28hyb@queuesmart.test', NULL, 'user'),
  ('u0mw3yaz6601z73b3', 'mock-mw3yaz66ic0@queuesmart.test', NULL, 'user');

INSERT INTO `user_profiles` (`email`, `fullName`, `dob`, `phone`, `preferences`) VALUES
  ('admin@queuesmart.test', 'QueueSmart Admin', '1980-01-01', NULL, NULL),
  ('mock-mw3yawwt1ln-1@queuesmart.test', 'Fatima Brown', '1978-07-08', '7135558820', NULL),
  ('mock-mw3yawwt1ln-10@queuesmart.test', 'Carlos Nguyen', '2002-04-23', '7135550095', NULL),
  ('mock-mw3yawwt1ln-11@queuesmart.test', 'Aisha Garcia', '1993-08-14', NULL, NULL),
  ('mock-mw3yawwt1ln-12@queuesmart.test', 'Sofia Nguyen', '1960-12-17', '7135552925', NULL),
  ('mock-mw3yawwt1ln-13@queuesmart.test', 'Wei Okafor', '1987-05-26', '7135555892', NULL),
  ('mock-mw3yawwt1ln-14@queuesmart.test', 'Wei Nguyen', '1969-03-20', '7135555775', NULL),
  ('mock-mw3yawwt1ln-15@queuesmart.test', 'James Brown', '1982-10-13', NULL, NULL),
  ('mock-mw3yawwt1ln-16@queuesmart.test', 'Noah Silva', '1980-03-11', NULL, NULL),
  ('mock-mw3yawwt1ln-17@queuesmart.test', 'Grace Silva', '1999-07-19', '7135558369', NULL),
  ('mock-mw3yawwt1ln-2@queuesmart.test', 'Priya Brown', '1953-08-01', '7135550315', NULL),
  ('mock-mw3yawwt1ln-3@queuesmart.test', 'Omar Okafor', '1999-01-05', '7135554498', NULL),
  ('mock-mw3yawwt1ln-4@queuesmart.test', 'Wei Lopez', '2002-08-06', '7135552041', NULL),
  ('mock-mw3yawwt1ln-5@queuesmart.test', 'Sofia Okafor', '2007-12-03', '7135551109', NULL),
  ('mock-mw3yawwt1ln-6@queuesmart.test', 'Sofia Johnson', '1993-01-21', '7135555203', NULL),
  ('mock-mw3yawwt1ln-7@queuesmart.test', 'Carlos Haddad', '1969-06-17', NULL, NULL),
  ('mock-mw3yawwt1ln-8@queuesmart.test', 'Wei Nguyen', '1992-06-16', '7135557859', NULL),
  ('mock-mw3yawwt1ln-9@queuesmart.test', 'Liam Lopez', '1963-12-05', '7135551634', NULL),
  ('mock-mw3yawx22g3@queuesmart.test', 'Carlos Silva', '1988-11-20', '7135558446', NULL),
  ('mock-mw3yawxp3d6@queuesmart.test', 'Fatima Lopez', '2008-01-03', NULL, NULL),
  ('mock-mw3yawy4458@queuesmart.test', 'Maria Johnson', '1976-04-04', '7135557163', NULL),
  ('mock-mw3yawyp5s9@queuesmart.test', 'Noah Okafor', '1978-03-19', '7135554250', NULL),
  ('mock-mw3yawz36b2@queuesmart.test', 'Wei Rossi', '1983-02-15', '7135554371', NULL),
  ('mock-mw3yawzh75c@queuesmart.test', 'Omar Okafor', '1980-12-02', '7135558216', NULL),
  ('mock-mw3yax02889@queuesmart.test', 'James Silva', '1995-09-16', '7135557963', NULL),
  ('mock-mw3yax0o9sz@queuesmart.test', 'Maria Nguyen', '1953-07-05', '7135556721', NULL),
  ('mock-mw3yax881zz-1@queuesmart.test', 'Maria Brown', '1961-09-02', '7135558531', NULL),
  ('mock-mw3yax881zz-10@queuesmart.test', 'Aisha Nguyen', '1978-05-04', '7135558595', NULL),
  ('mock-mw3yax881zz-11@queuesmart.test', 'Sofia Patel', '1964-09-05', '7135554870', NULL),
  ('mock-mw3yax881zz-12@queuesmart.test', 'Aisha Kim', '1970-12-07', NULL, NULL),
  ('mock-mw3yax881zz-13@queuesmart.test', 'Priya Okafor', '1964-12-15', '7135559335', NULL),
  ('mock-mw3yax881zz-14@queuesmart.test', 'Priya Nguyen', '1991-05-19', '7135559880', NULL),
  ('mock-mw3yax881zz-15@queuesmart.test', 'Grace Haddad', '1960-03-09', NULL, NULL),
  ('mock-mw3yax881zz-16@queuesmart.test', 'Carlos Silva', '1978-02-19', '7135552267', NULL),
  ('mock-mw3yax881zz-17@queuesmart.test', 'Maria Johnson', '1983-01-09', '7135553857', NULL),
  ('mock-mw3yax881zz-18@queuesmart.test', 'Aisha Brown', '1967-03-24', '7135557710', NULL),
  ('mock-mw3yax881zz-19@queuesmart.test', 'Fatima Okafor', '1962-11-17', '7135556993', NULL),
  ('mock-mw3yax881zz-2@queuesmart.test', 'Sofia Patel', '1953-09-20', NULL, NULL),
  ('mock-mw3yax881zz-3@queuesmart.test', 'Wei Haddad', '1963-08-28', '7135558258', NULL),
  ('mock-mw3yax881zz-4@queuesmart.test', 'Liam Johnson', '1966-12-16', NULL, NULL),
  ('mock-mw3yax881zz-5@queuesmart.test', 'Sofia Brown', '1954-10-03', NULL, NULL),
  ('mock-mw3yax881zz-6@queuesmart.test', 'Sofia Haddad', '1961-10-26', '7135557879', NULL),
  ('mock-mw3yax881zz-7@queuesmart.test', 'Wei Kim', '1969-12-27', '7135550310', NULL),
  ('mock-mw3yax881zz-8@queuesmart.test', 'James Chen', '2002-02-17', '7135553074', NULL),
  ('mock-mw3yax881zz-9@queuesmart.test', 'Maria Kim', '1993-11-19', '7135554532', NULL),
  ('mock-mw3yax8l2v8@queuesmart.test', 'Grace Chen', '2000-05-17', '7135553341', NULL),
  ('mock-mw3yax913ba@queuesmart.test', 'Fatima Okafor', '1966-11-04', '7135554186', NULL),
  ('mock-mw3yax9f4d7@queuesmart.test', 'Liam Kim', '1999-04-25', '7135551411', NULL),
  ('mock-mw3yax9u52v@queuesmart.test', 'Fatima Brown', '2005-12-07', NULL, NULL),
  ('mock-mw3yaxa86g2@queuesmart.test', 'Fatima Garcia', '1983-04-19', '7135555400', NULL),
  ('mock-mw3yaxal7bb@queuesmart.test', 'Priya Chen', '1981-11-27', '7135550382', NULL),
  ('mock-mw3yaxay8rj@queuesmart.test', 'Liam Johnson', '1996-12-19', '7135551779', NULL),
  ('mock-mw3yaxjo1p5@queuesmart.test', 'Priya Patel', '1983-07-12', NULL, NULL),
  ('mock-mw3yaxq726v@queuesmart.test', 'Wei Rossi', '1996-02-05', '7135559129', NULL),
  ('mock-mw3yaxs63mh@queuesmart.test', 'Maria Patel', '1971-12-24', '7135550201', NULL),
  ('mock-mw3yaxw54os@queuesmart.test', 'James Nguyen', '2005-04-10', '7135551903', NULL),
  ('mock-mw3yaxy75x6@queuesmart.test', 'Fatima Silva', '1957-07-24', '7135556491', NULL),
  ('mock-mw3yay1t67@queuesmart.test', 'Liam Rossi', '1996-07-10', NULL, NULL),
  ('mock-mw3yay447ql@queuesmart.test', 'Aisha Garcia', '1951-07-09', NULL, NULL),
  ('mock-mw3yay698le@queuesmart.test', 'Wei Silva', '1989-09-28', NULL, NULL),
  ('mock-mw3yay8g9i8@queuesmart.test', 'Carlos Patel', '1999-07-05', NULL, NULL),
  ('mock-mw3yayaoaqi@queuesmart.test', 'Aisha Haddad', '1998-12-14', NULL, NULL),
  ('mock-mw3yayieb25@queuesmart.test', 'Priya Lopez', '1972-03-12', '7135557915', NULL),
  ('mock-mw3yaykbceu@queuesmart.test', 'Noah Chen', '1954-07-09', '7135558268', NULL),
  ('mock-mw3yayq8dju@queuesmart.test', 'Noah Johnson', '2003-06-10', '7135559860', NULL),
  ('mock-mw3yays6exi@queuesmart.test', 'James Lopez', '1973-07-19', '7135558560', NULL),
  ('mock-mw3yayu5fqc@queuesmart.test', 'Wei Garcia', '1993-12-09', NULL, NULL),
  ('mock-mw3yaz0bgq4@queuesmart.test', 'Wei Chen', '1979-08-17', '7135557225', NULL),
  ('mock-mw3yaz28hyb@queuesmart.test', 'Wei Rossi', '1973-02-03', NULL, NULL),
  ('mock-mw3yaz66ic0@queuesmart.test', 'Omar Garcia', '1960-11-28', NULL, NULL),
  ('patient@queuesmart.test', 'Demo Patient', '1995-03-14', '7135550101', NULL),
  ('sample-patient-1@queuesmart.test', 'Sample Patient 1', '1981-01-11', '7135550201', NULL),
  ('sample-patient-2@queuesmart.test', 'Sample Patient 2', '1982-02-12', '7135550202', NULL),
  ('sample-patient-3@queuesmart.test', 'Sample Patient 3', '1983-03-13', '7135550203', NULL),
  ('sample-patient-4@queuesmart.test', 'Sample Patient 4', '1984-04-14', '7135550204', NULL),
  ('sample-patient-5@queuesmart.test', 'Sample Patient 5', '1985-05-15', '7135550205', NULL),
  ('sample-patient-6@queuesmart.test', 'Sample Patient 6', '1986-06-16', '7135550206', NULL),
  ('sample-patient-7@queuesmart.test', 'Sample Patient 7', '1987-07-17', '7135550207', NULL),
  ('sample-patient-8@queuesmart.test', 'Sample Patient 8', '1988-08-18', '7135550208', NULL),
  ('seed-patient-1@queuesmart.test', 'Demo Patient 1', '1990-01-01', NULL, NULL),
  ('seed-patient-10@queuesmart.test', 'Demo Patient 10', '1990-01-01', NULL, NULL),
  ('seed-patient-11@queuesmart.test', 'Demo Patient 11', '1990-01-01', NULL, NULL),
  ('seed-patient-12@queuesmart.test', 'Demo Patient 12', '1990-01-01', NULL, NULL),
  ('seed-patient-13@queuesmart.test', 'Demo Patient 13', '1990-01-01', NULL, NULL),
  ('seed-patient-14@queuesmart.test', 'Demo Patient 14', '1990-01-01', NULL, NULL),
  ('seed-patient-15@queuesmart.test', 'Demo Patient 15', '1990-01-01', NULL, NULL),
  ('seed-patient-2@queuesmart.test', 'Demo Patient 2', '1990-01-01', NULL, NULL),
  ('seed-patient-3@queuesmart.test', 'Demo Patient 3', '1990-01-01', NULL, NULL),
  ('seed-patient-4@queuesmart.test', 'Demo Patient 4', '1990-01-01', NULL, NULL),
  ('seed-patient-5@queuesmart.test', 'Demo Patient 5', '1990-01-01', NULL, NULL),
  ('seed-patient-6@queuesmart.test', 'Demo Patient 6', '1990-01-01', NULL, NULL),
  ('seed-patient-7@queuesmart.test', 'Demo Patient 7', '1990-01-01', NULL, NULL),
  ('seed-patient-8@queuesmart.test', 'Demo Patient 8', '1990-01-01', NULL, NULL),
  ('seed-patient-9@queuesmart.test', 'Demo Patient 9', '1990-01-01', NULL, NULL);

INSERT INTO `services` (`id`, `name`, `description`, `expectedDuration`, `priority`, `capacity`) VALUES
  ('s1', 'Sick Visit', 'Fever, cough, sore throat, ear pain, rashes, and other new symptoms.', 15, 'medium', 15),
  ('s2', 'Minor Injury', 'Sprains, small cuts, and minor burns that are not an emergency.', 20, 'high', 8),
  ('s3', 'Lab Work', 'Blood draws and specimen collection for tests your provider ordered.', 10, 'low', 20),
  ('s4', 'Vaccinations', 'Flu shots, boosters, and routine immunizations.', 5, 'low', 20),
  ('s5', 'Prescription Refill', 'A quick provider review to renew a medication you already take.', 10, 'low', 10);

INSERT INTO `queues` (`id`, `serviceId`, `status`) VALUES
  ('queue-s1', 's1', 'open'),
  ('queue-s2', 's2', 'open'),
  ('queue-s3', 's3', 'open'),
  ('queue-s4', 's4', 'open'),
  ('queue-s5', 's5', 'closed');

INSERT INTO `queue_entries` (`id`, `queueId`, `userId`, `reason`, `position`, `priority`, `status`, `joinedAt`, `calledAt`, `leftAt`) VALUES
  ('q-mock-mw3yawwt1ln-1', 'queue-s1', 'u-mock-mw3yawwt1ln-1', 'Cough that will not go away', 100, 'normal', 'canceled', 1793898053015, NULL, 1793898473015),
  ('q-mock-mw3yawwt1ln-10', 'queue-s3', 'u-mock-mw3yawwt1ln-10', 'A1C check', 102, 'normal', 'served', 1793899982686, 1793901902686, 1793902502686),
  ('q-mock-mw3yawwt1ln-11', 'queue-s3', 'u-mock-mw3yawwt1ln-11', 'Fasting blood work', 103, 'normal', 'canceled', 1793901502448, NULL, 1793901922448),
  ('q-mock-mw3yawwt1ln-12', 'queue-s3', 'u-mock-mw3yawwt1ln-12', 'Cholesterol panel', 104, 'normal', 'served', 1793901646128, 1793902306128, 1793902906128),
  ('q-mock-mw3yawwt1ln-13', 'queue-s3', 'u-mock-mw3yawwt1ln-13', 'Fasting blood work', 105, 'normal', 'served', 1793903614680, 1793904574680, 1793905174680),
  ('q-mock-mw3yawwt1ln-14', 'queue-s4', 'u-mock-mw3yawwt1ln-14', 'Flu shot', 100, 'normal', 'served', 1793898052234, 1793898712234, 1793899012234),
  ('q-mock-mw3yawwt1ln-15', 'queue-s4', 'u-mock-mw3yawwt1ln-15', 'COVID booster', 101, 'normal', 'served', 1793899910422, 1793901890422, 1793902190422),
  ('q-mock-mw3yawwt1ln-16', 'queue-s4', 'u-mock-mw3yawwt1ln-16', 'COVID booster', 102, 'normal', 'served', 1793901526151, 1793903266151, 1793903566151),
  ('q-mock-mw3yawwt1ln-17', 'queue-s4', 'u-mock-mw3yawwt1ln-17', 'COVID booster', 103, 'normal', 'served', 1793902329113, 1793902869113, 1793903169113),
  ('q-mock-mw3yawwt1ln-2', 'queue-s1', 'u-mock-mw3yawwt1ln-2', 'Sore throat for two days', 101, 'urgent', 'served', 1793899533849, 1793901033849, 1793901933849),
  ('q-mock-mw3yawwt1ln-3', 'queue-s1', 'u-mock-mw3yawwt1ln-3', 'Fever and chills', 102, 'urgent', 'served', 1793901819830, 1793903019830, 1793903919830),
  ('q-mock-mw3yawwt1ln-4', 'queue-s1', 'u-mock-mw3yawwt1ln-4', 'Sore throat for two days', 103, 'normal', 'served', 1793903268921, 1793903928921, 1793904828921),
  ('q-mock-mw3yawwt1ln-5', 'queue-s2', 'u-mock-mw3yawwt1ln-5', 'Sprained wrist', 100, 'normal', 'served', 1793898477056, 1793900037056, 1793901237056),
  ('q-mock-mw3yawwt1ln-6', 'queue-s2', 'u-mock-mw3yawwt1ln-6', 'Rolled ankle on stairs', 101, 'normal', 'served', 1793900689476, 1793902609476, 1793903809476),
  ('q-mock-mw3yawwt1ln-7', 'queue-s2', 'u-mock-mw3yawwt1ln-7', 'Sprained wrist', 102, 'normal', 'removed', 1793902948762, NULL, 1793904388762),
  ('q-mock-mw3yawwt1ln-8', 'queue-s3', 'u-mock-mw3yawwt1ln-8', 'A1C check', 100, 'urgent', 'served', 1793898040435, 1793899960435, 1793900560435),
  ('q-mock-mw3yawwt1ln-9', 'queue-s3', 'u-mock-mw3yawwt1ln-9', 'Cholesterol panel', 101, 'normal', 'served', 1793899024027, 1793899504027, 1793900104027),
  ('q-mock-mw3yax881zz-1', 'queue-s1', 'u-mock-mw3yax881zz-1', 'Ear pain', 100, 'urgent', 'served', 1793896965298, 1793897325298, 1793898225298),
  ('q-mock-mw3yax881zz-10', 'queue-s3', 'u-mock-mw3yax881zz-10', 'Fasting blood work', 100, 'normal', 'served', 1793897736657, 1793899236657, 1793899836657),
  ('q-mock-mw3yax881zz-11', 'queue-s3', 'u-mock-mw3yax881zz-11', 'Fasting blood work', 101, 'normal', 'canceled', 1793900324982, NULL, 1793901344982),
  ('q-mock-mw3yax881zz-12', 'queue-s3', 'u-mock-mw3yax881zz-12', 'A1C check', 102, 'normal', 'no-show', 1793901603184, 1793902923184, 1793903103184),
  ('q-mock-mw3yax881zz-13', 'queue-s3', 'u-mock-mw3yax881zz-13', 'A1C check', 103, 'urgent', 'canceled', 1793903822841, NULL, 1793904662841),
  ('q-mock-mw3yax881zz-14', 'queue-s4', 'u-mock-mw3yax881zz-14', 'Tetanus booster', 100, 'normal', 'served', 1793897807508, 1793899007508, 1793899307508),
  ('q-mock-mw3yax881zz-15', 'queue-s4', 'u-mock-mw3yax881zz-15', 'Flu shot', 101, 'normal', 'served', 1793898927198, 1793900667198, 1793900967198),
  ('q-mock-mw3yax881zz-16', 'queue-s4', 'u-mock-mw3yax881zz-16', 'COVID booster', 102, 'normal', 'no-show', 1793899492818, 1793899972818, 1793900152818),
  ('q-mock-mw3yax881zz-17', 'queue-s4', 'u-mock-mw3yax881zz-17', 'Flu shot', 103, 'normal', 'removed', 1793901380046, NULL, 1793901980046),
  ('q-mock-mw3yax881zz-18', 'queue-s4', 'u-mock-mw3yax881zz-18', 'COVID booster', 104, 'normal', 'served', 1793901806440, 1793903786440, 1793904086440),
  ('q-mock-mw3yax881zz-19', 'queue-s4', 'u-mock-mw3yax881zz-19', 'Flu shot', 105, 'normal', 'served', 1793903377153, 1793904397153, 1793904697153),
  ('q-mock-mw3yax881zz-2', 'queue-s1', 'u-mock-mw3yax881zz-2', 'Sore throat for two days', 101, 'normal', 'served', 1793899127471, 1793900027471, 1793900927471),
  ('q-mock-mw3yax881zz-3', 'queue-s1', 'u-mock-mw3yax881zz-3', 'Ear pain', 102, 'normal', 'served', 1793901883732, 1793903383732, 1793904283732),
  ('q-mock-mw3yax881zz-4', 'queue-s1', 'u-mock-mw3yax881zz-4', 'Fever and chills', 103, 'normal', 'canceled', 1793903561207, NULL, 1793904821207),
  ('q-mock-mw3yax881zz-5', 'queue-s2', 'u-mock-mw3yax881zz-5', 'Sprained wrist', 100, 'normal', 'no-show', 1793898002114, 1793898602114, 1793898782114),
  ('q-mock-mw3yax881zz-6', 'queue-s2', 'u-mock-mw3yax881zz-6', 'Rolled ankle on stairs', 101, 'normal', 'served', 1793898881638, 1793900921638, 1793902121638),
  ('q-mock-mw3yax881zz-7', 'queue-s2', 'u-mock-mw3yax881zz-7', 'Cut on hand from cooking', 102, 'normal', 'no-show', 1793900907707, 1793902887707, 1793903067707),
  ('q-mock-mw3yax881zz-8', 'queue-s2', 'u-mock-mw3yax881zz-8', 'Rolled ankle on stairs', 103, 'normal', 'served', 1793902151095, 1793902631095, 1793903831095),
  ('q-mock-mw3yax881zz-9', 'queue-s2', 'u-mock-mw3yax881zz-9', 'Sprained wrist', 104, 'urgent', 'served', 1793903286124, 1793905086124, 1793906286124),
  ('q-sample-1', 'queue-s1', 'u-sample-1', 'Earlier visit today', 101, 'normal', 'served', 1793893259535, 1793894579535, 1793895179535),
  ('q-sample-2', 'queue-s1', 'u-sample-2', 'Earlier visit today', 102, 'normal', 'served', 1793894159535, 1793896259535, 1793896859535),
  ('q-sample-3', 'queue-s1', 'u-sample-3', 'Earlier visit today', 103, 'normal', 'no-show', 1793895059535, NULL, 1793896859535),
  ('q-sample-4', 'queue-s2', 'u-sample-4', 'Earlier visit today', 104, 'normal', 'served', 1793895959535, 1793897039535, 1793897639535),
  ('q-sample-5', 'queue-s3', 'u-sample-5', 'Earlier visit today', 105, 'normal', 'served', 1793896859535, 1793897399535, 1793897999535),
  ('q-sample-6', 'queue-s3', 'u-sample-6', 'Earlier visit today', 106, 'normal', 'canceled', 1793897759535, NULL, 1793899559535),
  ('q-sample-7', 'queue-s4', 'u-sample-7', 'Earlier visit today', 107, 'normal', 'served', 1793898659535, 1793899019535, 1793899619535),
  ('q-sample-8', 'queue-s4', 'u-sample-8', 'Earlier visit today', 108, 'normal', 'removed', 1793899559535, NULL, 1793901359535),
  ('q-seed-1', 'queue-s1', 'u-seed-1', 'Fever and sore throat since Tuesday', 1, 'normal', 'called', 1793906759535, 1793907661554, NULL),
  ('q-seed-10', 'queue-s3', 'u-seed-10', 'Cholesterol panel', 10, 'normal', 'waiting', 1793907299535, NULL, NULL),
  ('q-seed-11', 'queue-s3', 'u-seed-11', 'A1C check', 11, 'normal', 'waiting', 1793907359535, NULL, NULL),
  ('q-seed-12', 'queue-s3', 'u-seed-12', 'Thyroid panel', 12, 'normal', 'waiting', 1793907419535, NULL, NULL),
  ('q-seed-13', 'queue-s4', 'u-seed-13', 'Flu shot', 13, 'normal', 'served', 1793907479535, 1793907662131, 1793907662419),
  ('q-seed-14', 'queue-s4', 'u-seed-14', 'Tetanus booster', 14, 'normal', 'canceled', 1793907539535, NULL, 1793907660469),
  ('q-seed-15', 'queue-s4', 'u-seed-15', 'Flu shot', 15, 'normal', 'waiting', 1793907599535, NULL, NULL),
  ('q-seed-2', 'queue-s1', 'u-seed-2', 'Ear pain, left side', 2, 'normal', 'waiting', 1793906819535, NULL, NULL),
  ('q-seed-3', 'queue-s1', 'u-seed-3', 'Cough for about a week', 3, 'normal', 'waiting', 1793906879535, NULL, NULL),
  ('q-seed-4', 'queue-s1', 'u-seed-4', 'Itchy rash on forearm', 4, 'normal', 'waiting', 1793906939535, NULL, NULL),
  ('q-seed-5', 'queue-s1', 'u-seed-5', 'Sinus pressure and headache', 5, 'normal', 'waiting', 1793906999535, NULL, NULL),
  ('q-seed-6', 'queue-s1', 'u-seed-6', 'Stomach pain since last night', 6, 'normal', 'waiting', 1793907059535, NULL, NULL),
  ('q-seed-7', 'queue-s2', 'u-seed-7', 'Twisted ankle at soccer practice', 7, 'normal', 'served', 1793907119535, 1793907660750, 1793907661494),
  ('q-seed-8', 'queue-s2', 'u-seed-8', 'Small cut on finger, needs a look', 8, 'normal', 'canceled', 1793907179535, NULL, 1793907660537),
  ('q-seed-9', 'queue-s3', 'u-seed-9', 'Fasting blood work for annual physical', 9, 'normal', 'waiting', 1793907239535, NULL, NULL),
  ('q0mw3yawx90027995', 'queue-s1', 'u0mw3yawx2001c986', 'Fever and chills', 7, 'normal', 'waiting', 1793907659565, NULL, NULL),
  ('q0mw3yawxw008029a', 'queue-s1', 'u0mw3yawxp007a312', 'Sore throat for two days', 8, 'normal', 'waiting', 1793907659588, NULL, NULL),
  ('q0mw3yawya00b5870', 'queue-s2', 'u0mw3yawy400a4df4', 'Rolled ankle on stairs', 9, 'normal', 'served', 1793907659602, 1793907661762, 1793907661834),
  ('q0mw3yawyv00h69fb', 'queue-s2', 'u0mw3yawyp00g772e', 'Sprained wrist', 10, 'normal', 'canceled', 1793907659623, NULL, 1793907661427),
  ('q0mw3yawz800ka0cf', 'queue-s2', 'u0mw3yawz300j2fca', 'Sprained wrist', 11, 'normal', 'waiting', 1793907659636, NULL, NULL),
  ('q0mw3yawzn00nef97', 'queue-s3', 'u0mw3yawzh00m5875', 'Fasting blood work', 13, 'normal', 'waiting', 1793907659651, NULL, NULL),
  ('q0mw3yax0700tbe18', 'queue-s4', 'u0mw3yax0200s3d23', 'Tetanus booster', 16, 'normal', 'waiting', 1793907659671, NULL, NULL),
  ('q0mw3yax0t00z40c2', 'queue-s4', 'u0mw3yax0o00ya97b', 'COVID booster', 17, 'normal', 'waiting', 1793907659693, NULL, NULL),
  ('q0mw3yax8s002151d', 'queue-s1', 'u0mw3yax8l0012a4c', 'Sore throat for two days', 9, 'normal', 'waiting', 1793907659980, NULL, NULL),
  ('q0mw3yax96005128f', 'queue-s1', 'u0mw3yax91004fcaf', 'Cough that will not go away', 10, 'normal', 'waiting', 1793907659994, NULL, NULL),
  ('q0mw3yax9l0082e36', 'queue-s2', 'u0mw3yax9f0074bbe', 'Rolled ankle on stairs', 12, 'normal', 'waiting', 1793907660009, NULL, NULL),
  ('q0mw3yaxa000b5095', 'queue-s3', 'u0mw3yax9u00a53ae', 'A1C check', 14, 'normal', 'waiting', 1793907660024, NULL, NULL),
  ('q0mw3yaxae00e21b5', 'queue-s3', 'u0mw3yaxa800ddbd0', 'Cholesterol panel', 15, 'normal', 'waiting', 1793907660038, NULL, NULL),
  ('q0mw3yaxar00h6bc2', 'queue-s4', 'u0mw3yaxal00g1e8b', 'Tetanus booster', 18, 'normal', 'waiting', 1793907660051, NULL, NULL),
  ('q0mw3yaxb400k87ca', 'queue-s4', 'u0mw3yaxay00jf9e8', 'COVID booster', 19, 'normal', 'waiting', 1793907660064, NULL, NULL),
  ('q0mw3yaxjv002b200', 'queue-s1', 'u0mw3yaxjo001ee6b', 'Sore throat for two days', 11, 'normal', 'waiting', 1793907660379, NULL, NULL),
  ('q0mw3yaxqd009f644', 'queue-s2', 'u0mw3yaxq80080a26', 'Cut on hand from cooking', 13, 'normal', 'canceled', 1793907660613, NULL, 1793907662202),
  ('q0mw3yaxsc00c14f0', 'queue-s3', 'u0mw3yaxs600b009a', 'Fasting blood work', 16, 'normal', 'waiting', 1793907660684, NULL, NULL),
  ('q0mw3yaxwe00h0086', 'queue-s4', 'u0mw3yaxw500gd1da', 'Tetanus booster', 20, 'normal', 'waiting', 1793907660830, NULL, NULL),
  ('q0mw3yaxye00k4746', 'queue-s1', 'u0mw3yaxy700j9895', 'Ear pain', 12, 'normal', 'waiting', 1793907660902, NULL, NULL),
  ('q0mw3yay2000n1be6', 'queue-s3', 'u0mw3yay1t00md538', 'Cholesterol panel', 17, 'normal', 'waiting', 1793907661032, NULL, NULL),
  ('q0mw3yay4a00q233d', 'queue-s2', 'u0mw3yay4400p0d7d', 'Rolled ankle on stairs', 14, 'normal', 'waiting', 1793907661114, NULL, NULL),
  ('q0mw3yay6e00t7b50', 'queue-s1', 'u0mw3yay6900s517d', 'Cough that will not go away', 13, 'normal', 'waiting', 1793907661190, NULL, NULL),
  ('q0mw3yay8m00w849d', 'queue-s1', 'u0mw3yay8g00v027e', 'Cough that will not go away', 14, 'normal', 'waiting', 1793907661270, NULL, NULL),
  ('q0mw3yayat00z5746', 'queue-s4', 'u0mw3yayao00y2c67', 'Flu shot', 21, 'normal', 'waiting', 1793907661349, NULL, NULL),
  ('q0mw3yayik017c904', 'queue-s4', 'u0mw3yayie0164db0', 'COVID booster', 22, 'normal', 'waiting', 1793907661628, NULL, NULL),
  ('q0mw3yaykh01a5d3c', 'queue-s3', 'u0mw3yaykb0195dc1', 'A1C check', 18, 'normal', 'waiting', 1793907661697, NULL, NULL),
  ('q0mw3yayqe01ga539', 'queue-s2', 'u0mw3yayq801f9590', 'Rolled ankle on stairs', 15, 'normal', 'waiting', 1793907661910, NULL, NULL),
  ('q0mw3yayse01j1773', 'queue-s2', 'u0mw3yays601i907f', 'Cut on hand from cooking', 16, 'normal', 'waiting', 1793907661982, NULL, NULL),
  ('q0mw3yayud01mb12a', 'queue-s1', 'u0mw3yayu501l46ca', 'Ear pain', 15, 'normal', 'waiting', 1793907662053, NULL, NULL),
  ('q0mw3yaz0g01tf945', 'queue-s4', 'u0mw3yaz0b01s7e3f', 'Tetanus booster', 23, 'normal', 'waiting', 1793907662272, NULL, NULL),
  ('q0mw3yaz2e01wd48e', 'queue-s3', 'u0mw3yaz2801v377e', 'A1C check', 19, 'normal', 'waiting', 1793907662342, NULL, NULL),
  ('q0mw3yaz6c0201002', 'queue-s4', 'u0mw3yaz6601z73b3', 'Flu shot', 24, 'normal', 'waiting', 1793907662484, NULL, NULL);

INSERT INTO `notifications` (`id`, `userId`, `entryId`, `serviceId`, `type`, `title`, `message`, `channels`, `createdAt`, `status`) VALUES
  ('n-mock-mw3yawwt1ln-1-joined', 'u-mock-mw3yawwt1ln-1', 'q-mock-mw3yawwt1ln-1', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #1 in line, no wait expected.', '[\"in-app\"]', 1793898053015, 'viewed'),
  ('n-mock-mw3yawwt1ln-10-called', 'u-mock-mw3yawwt1ln-10', 'q-mock-mw3yawwt1ln-10', 's3', 'called', 'Lab Work: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793901902686, 'viewed'),
  ('n-mock-mw3yawwt1ln-10-joined', 'u-mock-mw3yawwt1ln-10', 'q-mock-mw3yawwt1ln-10', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #3 in line, no wait expected.', '[\"in-app\"]', 1793899982686, 'viewed'),
  ('n-mock-mw3yawwt1ln-11-joined', 'u-mock-mw3yawwt1ln-11', 'q-mock-mw3yawwt1ln-11', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #4 in line, no wait expected.', '[\"in-app\"]', 1793901502448, 'viewed'),
  ('n-mock-mw3yawwt1ln-12-called', 'u-mock-mw3yawwt1ln-12', 'q-mock-mw3yawwt1ln-12', 's3', 'called', 'Lab Work: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793902306128, 'viewed'),
  ('n-mock-mw3yawwt1ln-12-joined', 'u-mock-mw3yawwt1ln-12', 'q-mock-mw3yawwt1ln-12', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #5 in line, no wait expected.', '[\"in-app\"]', 1793901646128, 'viewed'),
  ('n-mock-mw3yawwt1ln-13-called', 'u-mock-mw3yawwt1ln-13', 'q-mock-mw3yawwt1ln-13', 's3', 'called', 'Lab Work: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793904574680, 'viewed'),
  ('n-mock-mw3yawwt1ln-13-joined', 'u-mock-mw3yawwt1ln-13', 'q-mock-mw3yawwt1ln-13', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #6 in line, no wait expected.', '[\"in-app\"]', 1793903614680, 'viewed'),
  ('n-mock-mw3yawwt1ln-14-called', 'u-mock-mw3yawwt1ln-14', 'q-mock-mw3yawwt1ln-14', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793898712234, 'viewed'),
  ('n-mock-mw3yawwt1ln-14-joined', 'u-mock-mw3yawwt1ln-14', 'q-mock-mw3yawwt1ln-14', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #1 in line, no wait expected.', '[\"in-app\"]', 1793898052234, 'viewed'),
  ('n-mock-mw3yawwt1ln-15-called', 'u-mock-mw3yawwt1ln-15', 'q-mock-mw3yawwt1ln-15', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793901890422, 'viewed'),
  ('n-mock-mw3yawwt1ln-15-joined', 'u-mock-mw3yawwt1ln-15', 'q-mock-mw3yawwt1ln-15', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #2 in line, no wait expected.', '[\"in-app\"]', 1793899910422, 'viewed'),
  ('n-mock-mw3yawwt1ln-16-called', 'u-mock-mw3yawwt1ln-16', 'q-mock-mw3yawwt1ln-16', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793903266151, 'viewed'),
  ('n-mock-mw3yawwt1ln-16-joined', 'u-mock-mw3yawwt1ln-16', 'q-mock-mw3yawwt1ln-16', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #3 in line, no wait expected.', '[\"in-app\"]', 1793901526151, 'viewed'),
  ('n-mock-mw3yawwt1ln-17-called', 'u-mock-mw3yawwt1ln-17', 'q-mock-mw3yawwt1ln-17', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793902869113, 'viewed'),
  ('n-mock-mw3yawwt1ln-17-joined', 'u-mock-mw3yawwt1ln-17', 'q-mock-mw3yawwt1ln-17', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #4 in line, no wait expected.', '[\"in-app\"]', 1793902329113, 'viewed'),
  ('n-mock-mw3yawwt1ln-2-called', 'u-mock-mw3yawwt1ln-2', 'q-mock-mw3yawwt1ln-2', 's1', 'called', 'Sick Visit: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793901033849, 'viewed'),
  ('n-mock-mw3yawwt1ln-2-joined', 'u-mock-mw3yawwt1ln-2', 'q-mock-mw3yawwt1ln-2', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #2 in line, no wait expected.', '[\"in-app\"]', 1793899533849, 'viewed'),
  ('n-mock-mw3yawwt1ln-3-called', 'u-mock-mw3yawwt1ln-3', 'q-mock-mw3yawwt1ln-3', 's1', 'called', 'Sick Visit: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793903019830, 'viewed'),
  ('n-mock-mw3yawwt1ln-3-joined', 'u-mock-mw3yawwt1ln-3', 'q-mock-mw3yawwt1ln-3', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #3 in line, no wait expected.', '[\"in-app\"]', 1793901819830, 'viewed'),
  ('n-mock-mw3yawwt1ln-4-called', 'u-mock-mw3yawwt1ln-4', 'q-mock-mw3yawwt1ln-4', 's1', 'called', 'Sick Visit: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793903928921, 'viewed'),
  ('n-mock-mw3yawwt1ln-4-joined', 'u-mock-mw3yawwt1ln-4', 'q-mock-mw3yawwt1ln-4', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #4 in line, no wait expected.', '[\"in-app\"]', 1793903268921, 'viewed'),
  ('n-mock-mw3yawwt1ln-5-called', 'u-mock-mw3yawwt1ln-5', 'q-mock-mw3yawwt1ln-5', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793900037056, 'viewed'),
  ('n-mock-mw3yawwt1ln-5-joined', 'u-mock-mw3yawwt1ln-5', 'q-mock-mw3yawwt1ln-5', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #1 in line, no wait expected.', '[\"in-app\"]', 1793898477056, 'viewed'),
  ('n-mock-mw3yawwt1ln-6-called', 'u-mock-mw3yawwt1ln-6', 'q-mock-mw3yawwt1ln-6', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793902609476, 'viewed'),
  ('n-mock-mw3yawwt1ln-6-joined', 'u-mock-mw3yawwt1ln-6', 'q-mock-mw3yawwt1ln-6', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #2 in line, no wait expected.', '[\"in-app\"]', 1793900689476, 'viewed'),
  ('n-mock-mw3yawwt1ln-7-joined', 'u-mock-mw3yawwt1ln-7', 'q-mock-mw3yawwt1ln-7', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #3 in line, no wait expected.', '[\"in-app\"]', 1793902948762, 'viewed'),
  ('n-mock-mw3yawwt1ln-8-called', 'u-mock-mw3yawwt1ln-8', 'q-mock-mw3yawwt1ln-8', 's3', 'called', 'Lab Work: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793899960435, 'viewed'),
  ('n-mock-mw3yawwt1ln-8-joined', 'u-mock-mw3yawwt1ln-8', 'q-mock-mw3yawwt1ln-8', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #1 in line, no wait expected.', '[\"in-app\"]', 1793898040435, 'viewed'),
  ('n-mock-mw3yawwt1ln-9-called', 'u-mock-mw3yawwt1ln-9', 'q-mock-mw3yawwt1ln-9', 's3', 'called', 'Lab Work: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793899504027, 'viewed'),
  ('n-mock-mw3yawwt1ln-9-joined', 'u-mock-mw3yawwt1ln-9', 'q-mock-mw3yawwt1ln-9', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #2 in line, no wait expected.', '[\"in-app\"]', 1793899024027, 'viewed'),
  ('n-mock-mw3yax881zz-1-called', 'u-mock-mw3yax881zz-1', 'q-mock-mw3yax881zz-1', 's1', 'called', 'Sick Visit: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793897325298, 'viewed'),
  ('n-mock-mw3yax881zz-1-joined', 'u-mock-mw3yax881zz-1', 'q-mock-mw3yax881zz-1', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #1 in line, no wait expected.', '[\"in-app\"]', 1793896965298, 'viewed'),
  ('n-mock-mw3yax881zz-10-called', 'u-mock-mw3yax881zz-10', 'q-mock-mw3yax881zz-10', 's3', 'called', 'Lab Work: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793899236657, 'viewed'),
  ('n-mock-mw3yax881zz-10-joined', 'u-mock-mw3yax881zz-10', 'q-mock-mw3yax881zz-10', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #1 in line, no wait expected.', '[\"in-app\"]', 1793897736657, 'viewed'),
  ('n-mock-mw3yax881zz-11-joined', 'u-mock-mw3yax881zz-11', 'q-mock-mw3yax881zz-11', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #2 in line, no wait expected.', '[\"in-app\"]', 1793900324982, 'viewed'),
  ('n-mock-mw3yax881zz-12-called', 'u-mock-mw3yax881zz-12', 'q-mock-mw3yax881zz-12', 's3', 'called', 'Lab Work: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793902923184, 'viewed'),
  ('n-mock-mw3yax881zz-12-joined', 'u-mock-mw3yax881zz-12', 'q-mock-mw3yax881zz-12', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #3 in line, no wait expected.', '[\"in-app\"]', 1793901603184, 'viewed'),
  ('n-mock-mw3yax881zz-13-joined', 'u-mock-mw3yax881zz-13', 'q-mock-mw3yax881zz-13', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #4 in line, no wait expected.', '[\"in-app\"]', 1793903822841, 'viewed'),
  ('n-mock-mw3yax881zz-14-called', 'u-mock-mw3yax881zz-14', 'q-mock-mw3yax881zz-14', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793899007508, 'viewed'),
  ('n-mock-mw3yax881zz-14-joined', 'u-mock-mw3yax881zz-14', 'q-mock-mw3yax881zz-14', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #1 in line, no wait expected.', '[\"in-app\"]', 1793897807508, 'viewed'),
  ('n-mock-mw3yax881zz-15-called', 'u-mock-mw3yax881zz-15', 'q-mock-mw3yax881zz-15', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793900667198, 'viewed'),
  ('n-mock-mw3yax881zz-15-joined', 'u-mock-mw3yax881zz-15', 'q-mock-mw3yax881zz-15', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #2 in line, no wait expected.', '[\"in-app\"]', 1793898927198, 'viewed'),
  ('n-mock-mw3yax881zz-16-called', 'u-mock-mw3yax881zz-16', 'q-mock-mw3yax881zz-16', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793899972818, 'viewed'),
  ('n-mock-mw3yax881zz-16-joined', 'u-mock-mw3yax881zz-16', 'q-mock-mw3yax881zz-16', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #3 in line, no wait expected.', '[\"in-app\"]', 1793899492818, 'viewed'),
  ('n-mock-mw3yax881zz-17-joined', 'u-mock-mw3yax881zz-17', 'q-mock-mw3yax881zz-17', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #4 in line, no wait expected.', '[\"in-app\"]', 1793901380046, 'viewed'),
  ('n-mock-mw3yax881zz-18-called', 'u-mock-mw3yax881zz-18', 'q-mock-mw3yax881zz-18', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793903786440, 'viewed'),
  ('n-mock-mw3yax881zz-18-joined', 'u-mock-mw3yax881zz-18', 'q-mock-mw3yax881zz-18', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #5 in line, no wait expected.', '[\"in-app\"]', 1793901806440, 'viewed'),
  ('n-mock-mw3yax881zz-19-called', 'u-mock-mw3yax881zz-19', 'q-mock-mw3yax881zz-19', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793904397153, 'viewed'),
  ('n-mock-mw3yax881zz-19-joined', 'u-mock-mw3yax881zz-19', 'q-mock-mw3yax881zz-19', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #6 in line, no wait expected.', '[\"in-app\"]', 1793903377153, 'viewed'),
  ('n-mock-mw3yax881zz-2-called', 'u-mock-mw3yax881zz-2', 'q-mock-mw3yax881zz-2', 's1', 'called', 'Sick Visit: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793900027471, 'viewed'),
  ('n-mock-mw3yax881zz-2-joined', 'u-mock-mw3yax881zz-2', 'q-mock-mw3yax881zz-2', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #2 in line, no wait expected.', '[\"in-app\"]', 1793899127471, 'viewed'),
  ('n-mock-mw3yax881zz-3-called', 'u-mock-mw3yax881zz-3', 'q-mock-mw3yax881zz-3', 's1', 'called', 'Sick Visit: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793903383732, 'viewed'),
  ('n-mock-mw3yax881zz-3-joined', 'u-mock-mw3yax881zz-3', 'q-mock-mw3yax881zz-3', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #3 in line, no wait expected.', '[\"in-app\"]', 1793901883732, 'viewed'),
  ('n-mock-mw3yax881zz-4-joined', 'u-mock-mw3yax881zz-4', 'q-mock-mw3yax881zz-4', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #4 in line, no wait expected.', '[\"in-app\"]', 1793903561207, 'viewed'),
  ('n-mock-mw3yax881zz-5-called', 'u-mock-mw3yax881zz-5', 'q-mock-mw3yax881zz-5', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793898602114, 'viewed'),
  ('n-mock-mw3yax881zz-5-joined', 'u-mock-mw3yax881zz-5', 'q-mock-mw3yax881zz-5', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #1 in line, no wait expected.', '[\"in-app\"]', 1793898002114, 'viewed'),
  ('n-mock-mw3yax881zz-6-called', 'u-mock-mw3yax881zz-6', 'q-mock-mw3yax881zz-6', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793900921638, 'viewed'),
  ('n-mock-mw3yax881zz-6-joined', 'u-mock-mw3yax881zz-6', 'q-mock-mw3yax881zz-6', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #2 in line, no wait expected.', '[\"in-app\"]', 1793898881638, 'viewed'),
  ('n-mock-mw3yax881zz-7-called', 'u-mock-mw3yax881zz-7', 'q-mock-mw3yax881zz-7', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793902887707, 'viewed'),
  ('n-mock-mw3yax881zz-7-joined', 'u-mock-mw3yax881zz-7', 'q-mock-mw3yax881zz-7', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #3 in line, no wait expected.', '[\"in-app\"]', 1793900907707, 'viewed'),
  ('n-mock-mw3yax881zz-8-called', 'u-mock-mw3yax881zz-8', 'q-mock-mw3yax881zz-8', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793902631095, 'viewed'),
  ('n-mock-mw3yax881zz-8-joined', 'u-mock-mw3yax881zz-8', 'q-mock-mw3yax881zz-8', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #4 in line, no wait expected.', '[\"in-app\"]', 1793902151095, 'viewed'),
  ('n-mock-mw3yax881zz-9-called', 'u-mock-mw3yax881zz-9', 'q-mock-mw3yax881zz-9', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793905086124, 'viewed'),
  ('n-mock-mw3yax881zz-9-joined', 'u-mock-mw3yax881zz-9', 'q-mock-mw3yax881zz-9', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #5 in line, no wait expected.', '[\"in-app\"]', 1793903286124, 'viewed'),
  ('n-sample-1-called', 'u-sample-1', 'q-sample-1', 's1', 'called', 'Sick Visit: it’s your turn', 'Please come to the front desk now.', '[\"in-app\",\"sms\"]', 1793894579535, 'viewed'),
  ('n-sample-1-joined', 'u-sample-1', 'q-sample-1', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #2 in line, about 10-20 min.', '[\"in-app\",\"sms\"]', 1793893259535, 'viewed'),
  ('n-sample-2-called', 'u-sample-2', 'q-sample-2', 's1', 'called', 'Sick Visit: it’s your turn', 'Please come to the front desk now.', '[\"in-app\",\"sms\"]', 1793896259535, 'viewed'),
  ('n-sample-2-joined', 'u-sample-2', 'q-sample-2', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #2 in line, about 10-20 min.', '[\"in-app\",\"sms\"]', 1793894159535, 'viewed'),
  ('n-sample-3-joined', 'u-sample-3', 'q-sample-3', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #2 in line, about 10-20 min.', '[\"in-app\",\"sms\"]', 1793895059535, 'viewed'),
  ('n-sample-4-called', 'u-sample-4', 'q-sample-4', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\",\"sms\"]', 1793897039535, 'viewed'),
  ('n-sample-4-joined', 'u-sample-4', 'q-sample-4', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #2 in line, about 10-20 min.', '[\"in-app\",\"sms\"]', 1793895959535, 'viewed'),
  ('n-sample-5-called', 'u-sample-5', 'q-sample-5', 's3', 'called', 'Lab Work: it’s your turn', 'Please come to the front desk now.', '[\"in-app\",\"sms\"]', 1793897399535, 'viewed'),
  ('n-sample-5-joined', 'u-sample-5', 'q-sample-5', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #2 in line, about 10-20 min.', '[\"in-app\",\"sms\"]', 1793896859535, 'viewed'),
  ('n-sample-6-joined', 'u-sample-6', 'q-sample-6', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #2 in line, about 10-20 min.', '[\"in-app\",\"sms\"]', 1793897759535, 'viewed'),
  ('n-sample-7-called', 'u-sample-7', 'q-sample-7', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\",\"sms\"]', 1793899019535, 'viewed'),
  ('n-sample-7-joined', 'u-sample-7', 'q-sample-7', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #2 in line, about 10-20 min.', '[\"in-app\",\"sms\"]', 1793898659535, 'viewed'),
  ('n-sample-8-joined', 'u-sample-8', 'q-sample-8', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #2 in line, about 10-20 min.', '[\"in-app\",\"sms\"]', 1793899559535, 'viewed'),
  ('n0mw3yawxd00332b9', 'u0mw3yawx2001c986', 'q0mw3yawx90027995', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #7 in line, about 90-117 min.', '[\"in-app\",\"sms\"]', 1793907659569, 'sent'),
  ('n0mw3yawxh0048dbf', 'u-seed-1', 'q-seed-1', 's1', 'almost-up', 'Sick Visit: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659573, 'sent'),
  ('n0mw3yawxk005cd10', 'u-seed-2', 'q-seed-2', 's1', 'almost-up', 'Sick Visit: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659576, 'sent'),
  ('n0mw3yawxn0060528', 'u-seed-3', 'q-seed-3', 's1', 'almost-up', 'Sick Visit: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659579, 'sent'),
  ('n0mw3yawxz009fe58', 'u0mw3yawxp007a312', 'q0mw3yawxw008029a', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #8 in line, about 105-137 min.', '[\"in-app\"]', 1793907659591, 'sent'),
  ('n0mw3yawyc00c94bb', 'u0mw3yawy400a4df4', 'q0mw3yawya00b5870', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #3 in line, about 40-52 min.', '[\"in-app\",\"sms\"]', 1793907659604, 'viewed'),
  ('n0mw3yawyh00d4d71', 'u-seed-7', 'q-seed-7', 's2', 'almost-up', 'Minor Injury: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659609, 'viewed'),
  ('n0mw3yawyk00eab1c', 'u-seed-8', 'q-seed-8', 's2', 'almost-up', 'Minor Injury: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659612, 'viewed'),
  ('n0mw3yawyn00f84ac', 'u0mw3yawy400a4df4', 'q0mw3yawya00b5870', 's2', 'almost-up', 'Minor Injury: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\",\"sms\"]', 1793907659615, 'viewed'),
  ('n0mw3yawyy00i278a', 'u0mw3yawyp00g772e', 'q0mw3yawyv00h69fb', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #4 in line, about 60-78 min.', '[\"in-app\",\"sms\"]', 1793907659626, 'viewed'),
  ('n0mw3yawzb00ld9b7', 'u0mw3yawz300j2fca', 'q0mw3yawz800ka0cf', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #5 in line, about 80-104 min.', '[\"in-app\",\"sms\"]', 1793907659639, 'sent'),
  ('n0mw3yawzq00o7610', 'u0mw3yawzh00m5875', 'q0mw3yawzn00nef97', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #5 in line, about 40-52 min.', '[\"in-app\",\"sms\"]', 1793907659654, 'sent'),
  ('n0mw3yawzu00pdcc5', 'u-seed-9', 'q-seed-9', 's3', 'almost-up', 'Lab Work: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659658, 'sent'),
  ('n0mw3yawzx00q6568', 'u-seed-10', 'q-seed-10', 's3', 'almost-up', 'Lab Work: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659661, 'sent'),
  ('n0mw3yax0000r6f0e', 'u-seed-11', 'q-seed-11', 's3', 'almost-up', 'Lab Work: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659664, 'sent'),
  ('n0mw3yax0a00ubb4a', 'u0mw3yax0200s3d23', 'q0mw3yax0700tbe18', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #4 in line, about 15-20 min.', '[\"in-app\",\"sms\"]', 1793907659674, 'sent'),
  ('n0mw3yax0e00vd349', 'u-seed-13', 'q-seed-13', 's4', 'almost-up', 'Vaccinations: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659678, 'viewed'),
  ('n0mw3yax0j00wfa0e', 'u-seed-14', 'q-seed-14', 's4', 'almost-up', 'Vaccinations: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659683, 'viewed'),
  ('n0mw3yax0m00x2a36', 'u-seed-15', 'q-seed-15', 's4', 'almost-up', 'Vaccinations: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907659686, 'sent'),
  ('n0mw3yax0x010da2b', 'u0mw3yax0o00ya97b', 'q0mw3yax0t00z40c2', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #5 in line, about 20-26 min.', '[\"in-app\",\"sms\"]', 1793907659697, 'sent'),
  ('n0mw3yax8w0034dde', 'u0mw3yax8l0012a4c', 'q0mw3yax8s002151d', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #9 in line, about 120-156 min.', '[\"in-app\",\"sms\"]', 1793907659984, 'sent'),
  ('n0mw3yax9a006e3e6', 'u0mw3yax91004fcaf', 'q0mw3yax96005128f', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #10 in line, about 135-176 min.', '[\"in-app\",\"sms\"]', 1793907659998, 'sent'),
  ('n0mw3yax9o0097d81', 'u0mw3yax9f0074bbe', 'q0mw3yax9l0082e36', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #6 in line, about 100-130 min.', '[\"in-app\",\"sms\"]', 1793907660012, 'sent'),
  ('n0mw3yaxa300c351d', 'u0mw3yax9u00a53ae', 'q0mw3yaxa000b5095', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #6 in line, about 50-65 min.', '[\"in-app\"]', 1793907660027, 'sent'),
  ('n0mw3yaxah00f170d', 'u0mw3yaxa800ddbd0', 'q0mw3yaxae00e21b5', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #7 in line, about 60-78 min.', '[\"in-app\",\"sms\"]', 1793907660041, 'sent'),
  ('n0mw3yaxau00i3650', 'u0mw3yaxal00g1e8b', 'q0mw3yaxar00h6bc2', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #6 in line, about 25-33 min.', '[\"in-app\",\"sms\"]', 1793907660054, 'sent'),
  ('n0mw3yaxb700l3e56', 'u0mw3yaxay00jf9e8', 'q0mw3yaxb400k87ca', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #7 in line, about 30-39 min.', '[\"in-app\",\"sms\"]', 1793907660067, 'sent'),
  ('n0mw3yaxjz003d9d0', 'u0mw3yaxjo001ee6b', 'q0mw3yaxjv002b200', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #11 in line, about 150-195 min.', '[\"in-app\"]', 1793907660383, 'sent'),
  ('n0mw3yaxmk005fad5', 'u0mw3yax0200s3d23', 'q0mw3yax0700tbe18', 's4', 'almost-up', 'Vaccinations: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\",\"sms\"]', 1793907660476, 'sent'),
  ('n0mw3yaxoi007d64d', 'u0mw3yawyp00g772e', 'q0mw3yawyv00h69fb', 's2', 'almost-up', 'Minor Injury: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\",\"sms\"]', 1793907660546, 'viewed'),
  ('n0mw3yaxqg00af096', 'u0mw3yaxq80080a26', 'q0mw3yaxqd009f644', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #6 in line, about 100-130 min.', '[\"in-app\",\"sms\"]', 1793907660616, 'viewed'),
  ('n0mw3yaxsf00d047e', 'u0mw3yaxs600b009a', 'q0mw3yaxsc00c14f0', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #8 in line, about 70-91 min.', '[\"in-app\",\"sms\"]', 1793907660687, 'sent'),
  ('n0mw3yaxub00e8271', 'u-seed-7', 'q-seed-7', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793907660755, 'viewed'),
  ('n0mw3yaxui00f7c3c', 'u0mw3yawz300j2fca', 'q0mw3yawz800ka0cf', 's2', 'almost-up', 'Minor Injury: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\",\"sms\"]', 1793907660762, 'sent'),
  ('n0mw3yaxwh00i346f', 'u0mw3yaxw500gd1da', 'q0mw3yaxwe00h0086', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #7 in line, about 30-39 min.', '[\"in-app\",\"sms\"]', 1793907660833, 'sent'),
  ('n0mw3yaxyj00l90f1', 'u0mw3yaxy700j9895', 'q0mw3yaxye00k4746', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #12 in line, about 165-215 min.', '[\"in-app\",\"sms\"]', 1793907660907, 'sent'),
  ('n0mw3yay2300o0a4a', 'u0mw3yay1t00md538', 'q0mw3yay2000n1be6', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #9 in line, about 80-104 min.', '[\"in-app\"]', 1793907661035, 'sent'),
  ('n0mw3yay4d00r0d1e', 'u0mw3yay4400p0d7d', 'q0mw3yay4a00q233d', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #6 in line, about 100-130 min.', '[\"in-app\"]', 1793907661117, 'sent'),
  ('n0mw3yay6h00u97e0', 'u0mw3yay6900s517d', 'q0mw3yay6e00t7b50', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #13 in line, about 180-234 min.', '[\"in-app\"]', 1793907661193, 'sent'),
  ('n0mw3yay8p00x807d', 'u0mw3yay8g00v027e', 'q0mw3yay8m00w849d', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #14 in line, about 195-254 min.', '[\"in-app\"]', 1793907661273, 'sent'),
  ('n0mw3yayay01017c2', 'u0mw3yayao00y2c67', 'q0mw3yayat00z5746', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #8 in line, about 35-46 min.', '[\"in-app\"]', 1793907661354, 'sent'),
  ('n0mw3yayd7012c2ef', 'u0mw3yax9f0074bbe', 'q0mw3yax9l0082e36', 's2', 'almost-up', 'Minor Injury: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\",\"sms\"]', 1793907661435, 'sent'),
  ('n0mw3yaygl014974b', 'u-seed-1', 'q-seed-1', 's1', 'called', 'Sick Visit: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793907661557, 'sent'),
  ('n0mw3yaygr0150b17', 'u-seed-4', 'q-seed-4', 's1', 'almost-up', 'Sick Visit: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907661563, 'sent'),
  ('n0mw3yayin018398e', 'u0mw3yayie0164db0', 'q0mw3yayik017c904', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #9 in line, about 40-52 min.', '[\"in-app\",\"sms\"]', 1793907661631, 'sent'),
  ('n0mw3yaykk01b1b82', 'u0mw3yaykb0195dc1', 'q0mw3yaykh01a5d3c', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #10 in line, about 90-117 min.', '[\"in-app\",\"sms\"]', 1793907661700, 'sent'),
  ('n0mw3yayme01c744d', 'u0mw3yawy400a4df4', 'q0mw3yawya00b5870', 's2', 'called', 'Minor Injury: it’s your turn', 'Please come to the front desk now.', '[\"in-app\",\"sms\"]', 1793907661766, 'viewed'),
  ('n0mw3yaymj01d2891', 'u0mw3yaxq80080a26', 'q0mw3yaxqd009f644', 's2', 'almost-up', 'Minor Injury: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\",\"sms\"]', 1793907661771, 'viewed'),
  ('n0mw3yayqh01hdffa', 'u0mw3yayq801f9590', 'q0mw3yayqe01ga539', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #5 in line, about 80-104 min.', '[\"in-app\",\"sms\"]', 1793907661913, 'sent'),
  ('n0mw3yaysi01k5dcb', 'u0mw3yays601i907f', 'q0mw3yayse01j1773', 's2', 'joined', 'Minor Injury: you’re checked in', 'You’re #6 in line, about 100-130 min.', '[\"in-app\",\"sms\"]', 1793907661986, 'sent'),
  ('n0mw3yayui01ndb7c', 'u0mw3yayu501l46ca', 'q0mw3yayud01mb12a', 's1', 'joined', 'Sick Visit: you’re checked in', 'You’re #14 in line, about 195-254 min.', '[\"in-app\"]', 1793907662058, 'sent'),
  ('n0mw3yaywo01o4703', 'u-seed-13', 'q-seed-13', 's4', 'called', 'Vaccinations: it’s your turn', 'Please come to the front desk now.', '[\"in-app\"]', 1793907662136, 'viewed'),
  ('n0mw3yaywt01pee0a', 'u0mw3yax0o00ya97b', 'q0mw3yax0t00z40c2', 's4', 'almost-up', 'Vaccinations: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\",\"sms\"]', 1793907662141, 'sent'),
  ('n0mw3yayyr01r14fc', 'u0mw3yay4400p0d7d', 'q0mw3yay4a00q233d', 's2', 'almost-up', 'Minor Injury: head to the office', '2 or fewer patients are ahead of you.', '[\"in-app\"]', 1793907662211, 'sent'),
  ('n0mw3yaz0j01ubde4', 'u0mw3yaz0b01s7e3f', 'q0mw3yaz0g01tf945', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #9 in line, about 40-52 min.', '[\"in-app\",\"sms\"]', 1793907662275, 'sent'),
  ('n0mw3yaz2g01xe32d', 'u0mw3yaz2801v377e', 'q0mw3yaz2e01wd48e', 's3', 'joined', 'Lab Work: you’re checked in', 'You’re #11 in line, about 100-130 min.', '[\"in-app\"]', 1793907662344, 'sent'),
  ('n0mw3yaz6f021b233', 'u0mw3yaz6601z73b3', 'q0mw3yaz6c0201002', 's4', 'joined', 'Vaccinations: you’re checked in', 'You’re #10 in line, about 45-59 min.', '[\"in-app\"]', 1793907662487, 'sent');

INSERT INTO `visit_history` (`id`, `userId`, `serviceId`, `serviceName`, `date`, `joinedAt`, `calledAt`, `leftAt`, `outcome`) VALUES
  ('h-mock-mw3yawwt1ln-1', 'u-mock-mw3yawwt1ln-1', 's1', 'Sick Visit', '2026-11-05', 1793898053015, NULL, 1793898473015, 'cancelled'),
  ('h-mock-mw3yawwt1ln-10', 'u-mock-mw3yawwt1ln-10', 's3', 'Lab Work', '2026-11-05', 1793899982686, 1793901902686, 1793902502686, 'seen'),
  ('h-mock-mw3yawwt1ln-11', 'u-mock-mw3yawwt1ln-11', 's3', 'Lab Work', '2026-11-05', 1793901502448, NULL, 1793901922448, 'cancelled'),
  ('h-mock-mw3yawwt1ln-12', 'u-mock-mw3yawwt1ln-12', 's3', 'Lab Work', '2026-11-05', 1793901646128, 1793902306128, 1793902906128, 'seen'),
  ('h-mock-mw3yawwt1ln-13', 'u-mock-mw3yawwt1ln-13', 's3', 'Lab Work', '2026-11-05', 1793903614680, 1793904574680, 1793905174680, 'seen'),
  ('h-mock-mw3yawwt1ln-14', 'u-mock-mw3yawwt1ln-14', 's4', 'Vaccinations', '2026-11-05', 1793898052234, 1793898712234, 1793899012234, 'seen'),
  ('h-mock-mw3yawwt1ln-15', 'u-mock-mw3yawwt1ln-15', 's4', 'Vaccinations', '2026-11-05', 1793899910422, 1793901890422, 1793902190422, 'seen'),
  ('h-mock-mw3yawwt1ln-16', 'u-mock-mw3yawwt1ln-16', 's4', 'Vaccinations', '2026-11-05', 1793901526151, 1793903266151, 1793903566151, 'seen'),
  ('h-mock-mw3yawwt1ln-17', 'u-mock-mw3yawwt1ln-17', 's4', 'Vaccinations', '2026-11-05', 1793902329113, 1793902869113, 1793903169113, 'seen'),
  ('h-mock-mw3yawwt1ln-2', 'u-mock-mw3yawwt1ln-2', 's1', 'Sick Visit', '2026-11-05', 1793899533849, 1793901033849, 1793901933849, 'seen'),
  ('h-mock-mw3yawwt1ln-3', 'u-mock-mw3yawwt1ln-3', 's1', 'Sick Visit', '2026-11-05', 1793901819830, 1793903019830, 1793903919830, 'seen'),
  ('h-mock-mw3yawwt1ln-4', 'u-mock-mw3yawwt1ln-4', 's1', 'Sick Visit', '2026-11-05', 1793903268921, 1793903928921, 1793904828921, 'seen'),
  ('h-mock-mw3yawwt1ln-5', 'u-mock-mw3yawwt1ln-5', 's2', 'Minor Injury', '2026-11-05', 1793898477056, 1793900037056, 1793901237056, 'seen'),
  ('h-mock-mw3yawwt1ln-6', 'u-mock-mw3yawwt1ln-6', 's2', 'Minor Injury', '2026-11-05', 1793900689476, 1793902609476, 1793903809476, 'seen'),
  ('h-mock-mw3yawwt1ln-7', 'u-mock-mw3yawwt1ln-7', 's2', 'Minor Injury', '2026-11-05', 1793902948762, NULL, 1793904388762, 'removed'),
  ('h-mock-mw3yawwt1ln-8', 'u-mock-mw3yawwt1ln-8', 's3', 'Lab Work', '2026-11-05', 1793898040435, 1793899960435, 1793900560435, 'seen'),
  ('h-mock-mw3yawwt1ln-9', 'u-mock-mw3yawwt1ln-9', 's3', 'Lab Work', '2026-11-05', 1793899024027, 1793899504027, 1793900104027, 'seen'),
  ('h-mock-mw3yax881zz-1', 'u-mock-mw3yax881zz-1', 's1', 'Sick Visit', '2026-11-05', 1793896965298, 1793897325298, 1793898225298, 'seen'),
  ('h-mock-mw3yax881zz-10', 'u-mock-mw3yax881zz-10', 's3', 'Lab Work', '2026-11-05', 1793897736657, 1793899236657, 1793899836657, 'seen'),
  ('h-mock-mw3yax881zz-11', 'u-mock-mw3yax881zz-11', 's3', 'Lab Work', '2026-11-05', 1793900324982, NULL, 1793901344982, 'cancelled'),
  ('h-mock-mw3yax881zz-12', 'u-mock-mw3yax881zz-12', 's3', 'Lab Work', '2026-11-05', 1793901603184, 1793902923184, 1793903103184, 'no-show'),
  ('h-mock-mw3yax881zz-13', 'u-mock-mw3yax881zz-13', 's3', 'Lab Work', '2026-11-05', 1793903822841, NULL, 1793904662841, 'cancelled'),
  ('h-mock-mw3yax881zz-14', 'u-mock-mw3yax881zz-14', 's4', 'Vaccinations', '2026-11-05', 1793897807508, 1793899007508, 1793899307508, 'seen'),
  ('h-mock-mw3yax881zz-15', 'u-mock-mw3yax881zz-15', 's4', 'Vaccinations', '2026-11-05', 1793898927198, 1793900667198, 1793900967198, 'seen'),
  ('h-mock-mw3yax881zz-16', 'u-mock-mw3yax881zz-16', 's4', 'Vaccinations', '2026-11-05', 1793899492818, 1793899972818, 1793900152818, 'no-show'),
  ('h-mock-mw3yax881zz-17', 'u-mock-mw3yax881zz-17', 's4', 'Vaccinations', '2026-11-05', 1793901380046, NULL, 1793901980046, 'removed'),
  ('h-mock-mw3yax881zz-18', 'u-mock-mw3yax881zz-18', 's4', 'Vaccinations', '2026-11-05', 1793901806440, 1793903786440, 1793904086440, 'seen'),
  ('h-mock-mw3yax881zz-19', 'u-mock-mw3yax881zz-19', 's4', 'Vaccinations', '2026-11-05', 1793903377153, 1793904397153, 1793904697153, 'seen'),
  ('h-mock-mw3yax881zz-2', 'u-mock-mw3yax881zz-2', 's1', 'Sick Visit', '2026-11-05', 1793899127471, 1793900027471, 1793900927471, 'seen'),
  ('h-mock-mw3yax881zz-3', 'u-mock-mw3yax881zz-3', 's1', 'Sick Visit', '2026-11-05', 1793901883732, 1793903383732, 1793904283732, 'seen'),
  ('h-mock-mw3yax881zz-4', 'u-mock-mw3yax881zz-4', 's1', 'Sick Visit', '2026-11-05', 1793903561207, NULL, 1793904821207, 'cancelled'),
  ('h-mock-mw3yax881zz-5', 'u-mock-mw3yax881zz-5', 's2', 'Minor Injury', '2026-11-05', 1793898002114, 1793898602114, 1793898782114, 'no-show'),
  ('h-mock-mw3yax881zz-6', 'u-mock-mw3yax881zz-6', 's2', 'Minor Injury', '2026-11-05', 1793898881638, 1793900921638, 1793902121638, 'seen'),
  ('h-mock-mw3yax881zz-7', 'u-mock-mw3yax881zz-7', 's2', 'Minor Injury', '2026-11-05', 1793900907707, 1793902887707, 1793903067707, 'no-show'),
  ('h-mock-mw3yax881zz-8', 'u-mock-mw3yax881zz-8', 's2', 'Minor Injury', '2026-11-05', 1793902151095, 1793902631095, 1793903831095, 'seen'),
  ('h-mock-mw3yax881zz-9', 'u-mock-mw3yax881zz-9', 's2', 'Minor Injury', '2026-11-05', 1793903286124, 1793905086124, 1793906286124, 'seen'),
  ('h-sample-1', 'u-sample-1', 's1', 'Sick Visit', '2026-11-05', 1793893259535, 1793894579535, 1793895179535, 'seen'),
  ('h-sample-2', 'u-sample-2', 's1', 'Sick Visit', '2026-11-05', 1793894159535, 1793896259535, 1793896859535, 'seen'),
  ('h-sample-3', 'u-sample-3', 's1', 'Sick Visit', '2026-11-05', 1793895059535, NULL, 1793896859535, 'no-show'),
  ('h-sample-4', 'u-sample-4', 's2', 'Minor Injury', '2026-11-05', 1793895959535, 1793897039535, 1793897639535, 'seen'),
  ('h-sample-5', 'u-sample-5', 's3', 'Lab Work', '2026-11-05', 1793896859535, 1793897399535, 1793897999535, 'seen'),
  ('h-sample-6', 'u-sample-6', 's3', 'Lab Work', '2026-11-05', 1793897759535, NULL, 1793899559535, 'cancelled'),
  ('h-sample-7', 'u-sample-7', 's4', 'Vaccinations', '2026-11-05', 1793898659535, 1793899019535, 1793899619535, 'seen'),
  ('h-sample-8', 'u-sample-8', 's4', 'Vaccinations', '2026-11-05', 1793899559535, NULL, 1793901359535, 'removed'),
  ('h0mw3yaxma004ed21', 'u-seed-14', 's4', 'Vaccinations', '2026-11-05', 1793907539535, NULL, 1793907660465, 'cancelled'),
  ('h0mw3yaxo60067d69', 'u-seed-8', 's2', 'Minor Injury', '2026-11-05', 1793907179535, NULL, 1793907660533, 'cancelled'),
  ('h0mw3yaycw01147d7', 'u0mw3yawyp00g772e', 's2', 'Minor Injury', '2026-11-05', 1793907659623, NULL, 1793907661424, 'cancelled'),
  ('h0mw3yayes013bf21', 'u-seed-7', 's2', 'Minor Injury', '2026-11-05', 1793907119535, 1793907660750, 1793907661491, 'seen'),
  ('h0mw3yayo801e6b1f', 'u0mw3yawy400a4df4', 's2', 'Minor Injury', '2026-11-05', 1793907659602, 1793907661762, 1793907661831, 'seen'),
  ('h0mw3yayyg01q145e', 'u0mw3yaxq80080a26', 's2', 'Minor Injury', '2026-11-05', 1793907660613, NULL, 1793907662200, 'cancelled'),
  ('h0mw3yaz4h01yb7c8', 'u-seed-13', 's4', 'Vaccinations', '2026-11-05', 1793907479535, 1793907662131, 1793907662416, 'seen'),
  ('h1', 'u-patient', 's4', 'Vaccinations', '2026-09-28', 1790605800000, 1790607300000, 1790607600000, 'seen'),
  ('h2', 'u-patient', 's1', 'Sick Visit', '2026-08-14', 1786717800000, 1786719300000, 1786719600000, 'seen'),
  ('h3', 'u-patient', 's3', 'Lab Work', '2026-07-02', 1783002600000, NULL, 1783004400000, 'cancelled');

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
  DECLARE inLineNow INT DEFAULT 0;
  IF NEW.status IN ('waiting', 'called') THEN
    SELECT q.status, s.capacity INTO queueStatus, lineCapacity
    FROM queues q
    JOIN services s ON s.id = q.serviceId
    WHERE q.id = NEW.queueId;
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

DROP TRIGGER IF EXISTS trg_history_before_update$$

CREATE TRIGGER trg_history_before_update
BEFORE UPDATE ON visit_history
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'history-locked|Visit history cannot be edited.';
END$$

DELIMITER ;
