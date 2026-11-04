import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { close, nextId, query } from "../../src/database/mysql.js";
import * as historyRepo from "../../src/database/repositories/historyRepo.js";
import * as notificationRepo from "../../src/database/repositories/notificationRepo.js";
import * as queueRepo from "../../src/database/repositories/queueRepo.js";
import * as servicesRepo from "../../src/database/repositories/servicesRepo.js";
import * as userRepo from "../../src/database/repositories/userRepo.js";

// Runs against the team's shared database, so it only touches rows it created
// and deletes them at the end. Needs `npm run db:migrate` first.
const tag = nextId("test");
const email = `${tag}@queuesmart.test`;
const serviceName = `Test ${tag}`;

let user;
let service;
let entry;

const queueEntry = (overrides = {}) => ({
  userId: user.id,
  serviceId: service.id,
  reason: "Repository test",
  status: "waiting",
  priority: "normal",
  order: 1,
  arrivedAt: Date.now(),
  calledAt: null,
  ...overrides,
});

const newService = (overrides = {}) =>
  servicesRepo.insert({
    name: `${serviceName} ${nextId("x")}`,
    description: "Created by the repository tests.",
    expectedDuration: 10,
    priority: "low",
    capacity: 5,
    ...overrides,
  });

const newUser = (overrides = {}) =>
  userRepo.insert({
    name: "Repo Test",
    dob: "1990-02-03",
    email: `${nextId("t")}@queuesmart.test`,
    passwordHash: null,
    role: "user",
    ...overrides,
  });

const extraUsers = [];

beforeAll(async () => {
  user = await newUser({ email, phone: "7135550000" });
  service = await newService({ name: serviceName });
  entry = await queueRepo.insert(queueEntry());
});

afterAll(async () => {
  // Deleting a service removes its queue and entries; deleting credentials
  // removes the profile, entries, notifications and history (CASCADE).
  await query("DELETE FROM services WHERE name LIKE ?", [`${serviceName}%`]);
  await query("DELETE FROM user_credentials WHERE id IN (?)", [[user.id, ...extraUsers]]);
  await close();
});

describe("userRepo", () => {
  it("reads credentials and profile as one user", async () => {
    expect(await userRepo.findById(user.id)).toMatchObject({
      email,
      name: "Repo Test",
      dob: "1990-02-03",
      phone: "7135550000",
      role: "user",
      passwordHash: null,
    });
  });

  it("finds an email ignoring case and spaces", async () => {
    const found = await userRepo.findByEmail(`  ${email.toUpperCase()} `);
    expect(found.id).toBe(user.id);
  });

  it("returns null for an unknown user", async () => {
    expect(await userRepo.findById("nope")).toBeNull();
    expect(await userRepo.findByEmail("nobody@queuesmart.test")).toBeNull();
  });

  it("changes the password hash", async () => {
    await userRepo.setPasswordHash(user.id, "salt:hash");
    expect((await userRepo.findById(user.id)).passwordHash).toBe("salt:hash");
  });

  it("refuses a second account with the same email, in any case", async () => {
    await expect(newUser({ email: email.toUpperCase() })).rejects.toMatchObject({
      code: "ER_DUP_ENTRY",
    });
    // The transaction left no half-made account behind.
    const [{ count }] = await query("SELECT COUNT(*) AS count FROM user_credentials WHERE email = ?", [email]);
    expect(count).toBe(1);
  });

  it("refuses a phone number that is not 10 digits", async () => {
    await expect(newUser({ phone: "12345" })).rejects.toMatchObject({
      code: "ER_CHECK_CONSTRAINT_VIOLATED",
    });
  });
});

describe("servicesRepo", () => {
  it("keeps isOpen in the service's queue", async () => {
    expect((await servicesRepo.findById(service.id)).isOpen).toBe(true);
    expect((await servicesRepo.update(service.id, { isOpen: false })).isOpen).toBe(false);

    const [queue] = await query("SELECT status FROM queues WHERE serviceId = ?", [service.id]);
    expect(queue.status).toBe("closed");

    await servicesRepo.update(service.id, { isOpen: true });
  });

  it("updates service fields", async () => {
    expect((await servicesRepo.update(service.id, { capacity: 7 })).capacity).toBe(7);
  });

  it("includes the service in the list", async () => {
    const ids = (await servicesRepo.list()).map((row) => row.id);
    expect(ids).toContain(service.id);
  });

  it("finds a name ignoring case, except for the row being edited", async () => {
    expect((await servicesRepo.findByName(serviceName.toUpperCase())).id).toBe(service.id);
    expect(await servicesRepo.findByName(serviceName, service.id)).toBeNull();
  });

  it("refuses values outside the column rules", async () => {
    await expect(newService({ expectedDuration: 500 })).rejects.toMatchObject({
      code: "ER_CHECK_CONSTRAINT_VIOLATED",
    });
    await expect(newService({ priority: "urgent" })).rejects.toMatchObject({
      code: "WARN_DATA_TRUNCATED",
    });
  });

  it("removes a service with its queue and entries", async () => {
    const extra = await newService({ isOpen: false });
    const extraEntry = await queueRepo.insert(queueEntry({ serviceId: extra.id, userId: (await newUser()).id }));
    extraUsers.push(extraEntry.userId);

    await servicesRepo.remove(extra.id);

    expect(await servicesRepo.findById(extra.id)).toBeNull();
    expect(await queueRepo.findById(extraEntry.id)).toBeNull();
  });
});

describe("queueRepo", () => {
  it("reads an entry back with the API's names and times as numbers", async () => {
    const found = await queueRepo.findById(entry.id);
    expect(found).toMatchObject({
      serviceId: service.id,
      order: 1,
      calledAt: null,
      leftAt: null,
      arrivedAt: entry.arrivedAt,
    });
    expect(found.arrivedAt).toEqual(expect.any(Number));
  });

  it("lists a line in order, and only waiting patients as waiting", async () => {
    const other = await newUser();
    extraUsers.push(other.id);
    const second = await queueRepo.insert(
      queueEntry({ userId: other.id, order: 2, status: "called", calledAt: Date.now() })
    );

    expect((await queueRepo.listByService(service.id)).map((row) => row.id)).toEqual([entry.id, second.id]);
    expect((await queueRepo.listWaiting(service.id)).map((row) => row.id)).toEqual([entry.id]);
    expect((await queueRepo.findCalled(service.id)).id).toBe(second.id);

    await queueRepo.finish(second.id, "served");
    expect(await queueRepo.findCalled(service.id)).toBeNull();
    expect(await queueRepo.findById(second.id)).toMatchObject({
      status: "served",
      leftAt: expect.any(Number),
    });
  });

  it("finds the active entry for a patient", async () => {
    expect((await queueRepo.findActiveByUser(user.id)).id).toBe(entry.id);
    expect(await queueRepo.findActiveByUser("nope")).toBeNull();
  });

  it("allows one active check-in per patient", async () => {
    await expect(queueRepo.insert(queueEntry({ order: 3 }))).rejects.toMatchObject({
      code: "ER_DUP_ENTRY",
    });
  });

  it("allows one called patient per queue", async () => {
    const [first, second] = [await newUser(), await newUser()];
    extraUsers.push(first.id, second.id);
    const calledAt = Date.now();
    await queueRepo.insert(queueEntry({ userId: first.id, order: 4, status: "called", calledAt }));

    await expect(
      queueRepo.insert(queueEntry({ userId: second.id, order: 5, status: "called", calledAt }))
    ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });

  it("updates a column named after a SQL keyword", async () => {
    expect((await queueRepo.update(entry.id, { order: 4 })).order).toBe(4);
  });

  it("lets a patient check in again once their entry is finished", async () => {
    await queueRepo.finish(entry.id, "canceled");

    entry = await queueRepo.insert(queueEntry({ order: 6 }));

    expect((await queueRepo.findActiveByUser(user.id)).id).toBe(entry.id);
  });
});

describe("notificationRepo", () => {
  it("saves, lists newest first and marks notifications viewed", async () => {
    const older = await notificationRepo.insert({ userId: user.id, title: "First", message: "One." });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await notificationRepo.insert({ userId: user.id, title: "Second", message: "Two." });

    const listed = await notificationRepo.listByUser(user.id);
    expect(listed.map((row) => row.id)).toEqual([newer.id, older.id]);
    expect(listed[0]).toMatchObject({ status: "sent", createdAt: expect.any(Number) });

    expect(await notificationRepo.markViewed(user.id, older.id)).toBe(true);
    expect(await notificationRepo.markViewed("someone-else", newer.id)).toBe(false);

    await notificationRepo.markAllViewed(user.id);
    const after = await notificationRepo.listByUser(user.id);
    expect(after.every((row) => row.status === "viewed")).toBe(true);
  });
});

describe("historyRepo", () => {
  it("reads rows by patient, newest first, and by date", async () => {
    const row = (leftAt) => ({
      userId: user.id,
      serviceId: service.id,
      serviceName,
      date: "2026-01-15",
      joinedAt: leftAt - 1000,
      calledAt: null,
      leftAt,
      outcome: "seen",
    });
    const older = await historyRepo.insert(row(1_000_000));
    const newer = await historyRepo.insert(row(2_000_000));

    const mine = await historyRepo.listByUser(user.id);
    expect(mine.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(mine[0].date).toBe("2026-01-15");

    const onDate = (await historyRepo.listByDate("2026-01-15")).map((item) => item.id);
    expect(onDate).toEqual(expect.arrayContaining([older.id, newer.id]));
  });
});
