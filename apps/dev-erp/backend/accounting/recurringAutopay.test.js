import test from "node:test";
import assert from "node:assert/strict";
import { planAutopayPeriods, processAutopayExpense, runRecurringAutopaySweep, shiftAutopayMonth } from "./recurringAutopay.js";

const utc = (s) => new Date(`${s}T00:00:00.000Z`);
const rootEntry = (overrides = {}) => ({
  id: 1,
  organizationId: 11,
  type: "EXPENSE",
  status: "PAID",
  source: "MANUAL",
  archivedAt: null,
  autopayEnabled: true,
  recurrenceParentId: null,
  recurrenceAnchorAt: utc("2026-05-01"),
  recurringInterval: "MONTHLY",
  currency: "GHS",
  amount: 90,
  serviceName: "Hosting",
  detail: "Renewal",
  paidAt: utc("2026-05-01"),
  dueAt: null,
  ...overrides,
});
const toTime = (value) => value instanceof Date ? value.getTime() : value;
const matches = (row, where = {}) => Object.entries(where).every(([key, expected]) => {
  const value = row[key] ?? null;
  if (expected && typeof expected === "object" && !(expected instanceof Date)) {
    if ("not" in expected) return toTime(value) !== toTime(expected.not);
    if ("lte" in expected) return value && toTime(value) <= toTime(expected.lte);
    if ("in" in expected) return expected.in.includes(value);
  }
  return toTime(value) === toTime(expected);
});
const memoryDb = (initial = []) => {
  const rows = initial.map((entry) => ({ ...entry }));
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  const select = (row, options) => options ? Object.fromEntries(Object.keys(options).map((field) => [field, row[field]])) : { ...row };
  const accountingEntry = {
    async findMany({ where, select: pick, take } = {}) {
      const found = rows.filter((row) => matches(row, where)).map((row) => select(row, pick));
      return take ? found.slice(0, take) : found;
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of rows) {
        if (matches(row, where)) { Object.assign(row, data); count += 1; }
      }
      return { count };
    },
    async createMany({ data, skipDuplicates }) {
      let count = 0;
      for (const record of data) {
        const exists = rows.some((r) =>
          r.recurrenceParentId === record.recurrenceParentId &&
          toTime(r.recurrencePeriodAt) === toTime(record.recurrencePeriodAt));
        if (exists && skipDuplicates) continue;
        rows.push({ ...record, id: nextId++ });
        count += 1;
      }
      return { count };
    },
  };
  return { rows, accountingEntry, $transaction: (fn) => fn({ accountingEntry }) };
};

test("monthly anchoring keeps the original billing day after a short month", () => {
  assert.equal(shiftAutopayMonth(utc("2026-01-31"), 1).toISOString(), utc("2026-02-28").toISOString());
  assert.equal(shiftAutopayMonth(utc("2026-01-31"), 2).toISOString(), utc("2026-03-31").toISOString());
  assert.equal(shiftAutopayMonth(utc("2024-01-31"), 1).toISOString(), utc("2024-02-29").toISOString());
});

test("May autopay catches up missed June–November payments and schedules December", async () => {
  const db = memoryDb([rootEntry()]);
  const result = await processAutopayExpense(db, db.rows[0], { now: utc("2026-11-09") });
  assert.deepEqual(result, { created: 7, adopted: 0, paid: 0 });
  const children = db.rows.filter((r) => r.recurrenceParentId === 1);
  assert.deepEqual(children.map((r) => r.recurrencePeriodAt.toISOString().slice(0, 10)),
    ["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"]);
  assert.equal(children.filter((r) => r.status === "PAID").length, 6);
  assert.equal(children[6].status, "SCHEDULED");
  assert.equal(children[5].paidAt.toISOString(), utc("2026-11-01").toISOString());
  const repeat = await processAutopayExpense(db, db.rows[0], { now: utc("2026-11-09") });
  assert.deepEqual(repeat, { created: 0, adopted: 0, paid: 0 });
  assert.equal(db.rows.length, 8);
});

test("legacy pending scheduled child is adopted instead of duplicated", async () => {
  const legacy = {
    ...rootEntry(), id: 2, autopayEnabled: false, status: "SCHEDULED", paidAt: null,
    recurrenceAnchorAt: null, dueAt: utc("2026-06-01"),
  };
  const db = memoryDb([rootEntry(), legacy]);
  const result = await processAutopayExpense(db, db.rows[0], { now: utc("2026-06-15") });
  assert.deepEqual(result, { created: 1, adopted: 1, paid: 1 });
  assert.equal(db.rows.find((r) => r.id === 2).status, "PAID");
  assert.equal(db.rows.find((r) => r.id === 2).recurrenceParentId, 1);
  assert.equal(db.rows.filter((r) => r.recurrencePeriodAt?.toISOString() === utc("2026-06-01").toISOString()).length, 1);
});

test("future autopay root stays scheduled until its initial billing date", async () => {
  const root = rootEntry({ status: "SCHEDULED", paidAt: null, dueAt: utc("2026-12-01"), recurrenceAnchorAt: utc("2026-12-01") });
  const db = memoryDb([root]);
  await processAutopayExpense(db, root, { now: utc("2026-11-09") });
  assert.equal(db.rows[0].status, "SCHEDULED");
  assert.equal(db.rows.length, 1);
  const result = await processAutopayExpense(db, root, { now: utc("2026-12-01") });
  assert.equal(result.paid, 1);
  assert.equal(db.rows[0].paidAt.toISOString(), utc("2026-12-01").toISOString());
  assert.equal(db.rows.find((r) => r.recurrenceParentId === 1).recurrencePeriodAt.toISOString(), utc("2027-01-01").toISOString());
});

test("manual, archived, and revenue recurrence are never auto-posted", async () => {
  const db = memoryDb([
    rootEntry({ id: 1, autopayEnabled: false }),
    rootEntry({ id: 2, archivedAt: utc("2026-06-01") }),
    rootEntry({ id: 3, type: "REVENUE" }),
  ]);
  const result = await runRecurringAutopaySweep(db, { now: utc("2026-11-09") });
  assert.equal(result.series, 0);
  assert.equal(db.rows.length, 3);
});

test("quarterly and yearly periods use original anchor and include only next future date", () => {
  const quarterly = planAutopayPeriods(rootEntry({ recurringInterval: "QUARTERLY" }), utc("2026-11-09"));
  assert.deepEqual(quarterly.map((d) => d.toISOString().slice(0, 10)), ["2026-08-01", "2026-11-01", "2027-02-01"]);
  const yearly = planAutopayPeriods(rootEntry({ recurringInterval: "YEARLY" }), utc("2026-11-09"));
  assert.deepEqual(yearly.map((d) => d.toISOString().slice(0, 10)), ["2027-05-01"]);
});

test("explicit exception records do not get auto-marked paid", async () => {
  const corrected = {
    ...rootEntry({ id: 2, status: "OVERDUE", autopayEnabled: false }),
    recurrenceParentId: 1, recurrencePeriodAt: utc("2026-06-01"), paidAt: null,
  };
  const db = memoryDb([rootEntry(), corrected]);
  await processAutopayExpense(db, db.rows[0], { now: utc("2026-07-09") });
  assert.equal(db.rows.find((r) => r.id === 2).status, "OVERDUE");
});
