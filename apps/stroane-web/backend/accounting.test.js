import assert from "node:assert/strict";
import test from "node:test";
import { signToken } from "./src/auth.js";
import { createAdminAccountingRouter } from "./src/accounting/routes.js";

const createResponse = (resolve) => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    resolve();
    return this;
  },
});

const createAdminLookup = (id = "admin-1") => ({
  findUnique: async (query) => {
    assert.deepEqual(query.where, { id });
    return {
      id,
      username: "admin",
      role: "ADMIN",
      isActive: true,
      customRole: null,
    };
  },
});

const handleRouter = async (router, request) => {
  let response;
  await new Promise((resolve, reject) => {
    response = createResponse(resolve);
    router.handle(request, response, (error) => (error ? reject(error) : resolve()));
  });
  return response;
};

test("expense route records unpaid expenses as accounting liabilities", async () => {
  process.env.APP_AUTH_SECRET = "expense-create-test-secret";
  let createdEntry = null;
  const prisma = {
    siteUser: createAdminLookup(),
    accountingLedgerEntry: {
      findMany: async () => [],
      create: async ({ data }) => {
        createdEntry = data;
        return {
          id: "expense-1",
          ...data,
          createdAt: new Date("2026-07-04T10:00:00Z"),
          updatedAt: new Date("2026-07-04T10:00:00Z"),
        };
      },
    },
  };
  const router = createAdminAccountingRouter(prisma);
  const token = signToken({ id: "admin-1", username: "admin", role: "ADMIN" });

  const response = await handleRouter(router, {
    method: "POST",
    url: "/accounting/expenses",
    headers: { authorization: `Bearer ${token}` },
    body: {
      expenseClass: "operations",
      category: "Operations",
      counterparty: "Packaging supplier",
      description: "July packaging invoice",
      amount: 85.5,
      currency: "GHS",
      expenseDate: "2026-07-04",
      dueDate: "2026-07-20",
      paymentStatus: "unpaid",
      reference: "INV-85",
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(createdEntry.entryType, "LIABILITY");
  assert.equal(createdEntry.source, "manual_expense");
  assert.equal(createdEntry.paymentStatus, "unpaid");
  assert.equal(createdEntry.status, "unpaid");
  assert.equal(createdEntry.expenseClass, "operations");
  assert.equal(createdEntry.counterparty, "Packaging supplier");
  assert.equal(response.body.expense.entryType, "liability");
  assert.equal(response.body.expense.paymentStatus, "unpaid");
});

test("accounting overview includes paid expenses and unpaid expense liabilities", async () => {
  process.env.APP_AUTH_SECRET = "expense-overview-test-secret";
  const entries = [
    {
      id: "paid-expense",
      entryType: "EXPENSE",
      category: "Delivery",
      expenseClass: "delivery",
      counterparty: "Courier",
      description: "Courier dispatches",
      amount: 120,
      currency: "GHS",
      entryDate: new Date("2026-07-01T00:00:00Z"),
      dueDate: null,
      paymentStatus: "paid",
      source: "manual_expense",
      status: "paid",
      createdAt: new Date("2026-07-01T00:00:00Z"),
      updatedAt: new Date("2026-07-01T00:00:00Z"),
    },
    {
      id: "unpaid-expense",
      entryType: "LIABILITY",
      category: "Operations",
      expenseClass: "operations",
      counterparty: "Supplier",
      description: "Supplier invoice",
      amount: 50,
      currency: "GHS",
      entryDate: new Date("2026-07-02T00:00:00Z"),
      dueDate: new Date("2026-07-12T00:00:00Z"),
      paymentStatus: "unpaid",
      source: "manual_expense",
      status: "unpaid",
      createdAt: new Date("2026-07-02T00:00:00Z"),
      updatedAt: new Date("2026-07-02T00:00:00Z"),
    },
  ];
  const prisma = {
    siteUser: createAdminLookup(),
    commerceOrder: { findMany: async () => [] },
    commerceReceipt: { findMany: async () => [] },
    inventoryItem: { findMany: async () => [] },
    catalogueProduct: { findMany: async () => [] },
    accountingLedgerEntry: {
      findMany: async () => entries,
    },
  };
  const router = createAdminAccountingRouter(prisma);
  const token = signToken({ id: "admin-1", username: "admin", role: "ADMIN" });

  const response = await handleRouter(router, {
    method: "GET",
    url: "/accounting/overview",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.summary.expenses, 120);
  assert.equal(response.body.summary.liabilityTotal, 50);
  assert.equal(response.body.summary.expenseLiabilities, 50);
  assert.equal(response.body.summary.expenseExposure, 170);
  assert.equal(response.body.summary.expenseEntryCount, 2);
});
