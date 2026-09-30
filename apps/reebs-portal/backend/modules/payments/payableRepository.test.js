import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayableCharge, loadPayable, normalizePayableType } from "./payableRepository.js";

test("normalizes only supported payable relationships", () => {
  assert.equal(normalizePayableType("water-order"), "WATER_ORDER");
  assert.equal(normalizePayableType("other"), null);
});

test("Order payable balance preserves all established successful ledger aliases", async () => {
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      return {
        rows: [{
          id: 4,
          reference: "ORD-4",
          customerId: 2,
          customerName: "Ama",
          customerEmail: "ama@example.com",
          currency: "GHS",
          businessUnit: "REEBS_CORE",
          grandTotalCents: 10000,
          amountPaidCents: 5000,
          status: "partially_paid",
        }],
      };
    },
  };
  await loadPayable(client, {
    organizationId: 1,
    payableType: "ORDER",
    payableId: 4,
  });
  assert.match(queries[0], /IN \('successful', 'confirmed', 'paid'\)/);
});

test("auto charge uses the remaining booking deposit before the balance", () => {
  assert.deepEqual(calculatePayableCharge({
    totalCents: 100000,
    amountPaidCents: 10000,
    depositRequiredCents: 30000,
  }), {
    amountCents: 20000,
    amountPaidCents: 10000,
    balanceDueCents: 90000,
    depositRequiredCents: 30000,
    purpose: "DEPOSIT",
  });
});

test("balance charges never accept a client supplied amount", () => {
  assert.equal(calculatePayableCharge({ totalCents: 50000, amountPaidCents: 12000 }, "BALANCE").amountCents, 38000);
});

test("settled records cannot create a payment attempt", () => {
  assert.throws(
    () => calculatePayableCharge({ totalCents: 5000, amountPaidCents: 5000 }),
    (error) => error.code === "PAYABLE_ALREADY_SETTLED"
  );
});

test("cancelled, refunded and void records cannot be charged despite a positive historical balance", () => {
  for (const sourceStatus of ["Cancelled", "canceled", "refunded", "VOIDED", "archived"]) {
    assert.throws(() => calculatePayableCharge({
      totalCents: 5000, amountPaidCents: 0, sourceStatus,
    }), (error) => error.code === "PAYABLE_CLOSED");
  }
  // Operational completion does not forgive an outstanding customer debt.
  assert.equal(calculatePayableCharge({ totalCents: 5000, amountPaidCents: 0, sourceStatus: "Completed" }).amountCents, 5000);
});

test("an archived Water sale cannot accept payment or read its application balance", async () => {
  const client = { async query(sql) {
    if (sql.includes('FROM "waterSale"')) return { rows: [{
      id: 5, totalAmount: 4500, paymentStatus: "pending", archivedAt: "2026-09-24T00:00:00Z",
    }] };
    assert.fail("archived sales must be rejected before loading payment applications");
  } };
  await assert.rejects(() => loadPayable(client, {
    organizationId: 1, payableType: "WATER_ORDER", payableId: 5,
  }), (error) => error.code === "PAYABLE_NOT_FOUND");
});

test("Water scope is derived from the Water sale rather than request data", async () => {
  const client = {
    async query(sql) {
      if (sql.includes('FROM "waterSale"')) return { rows: [{
        id: 5,
        reference: "WATER-000005",
        customerId: 7,
        customerName: "Kojo",
        customerEmail: "kojo@example.com",
        totalAmount: 4500,
        paymentStatus: "pending",
      }] };
      if (sql.includes('FROM "paymentApplication"')) return { rows: [{ amountPaidCents: 0 }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const payable = await loadPayable(client, {
    organizationId: 1,
    payableType: "WATER_ORDER",
    payableId: 5,
    businessUnit: "REEBS_CORE",
  });
  assert.equal(payable.businessUnit, "WATER");
  assert.equal(payable.currency, "GHS");
});
