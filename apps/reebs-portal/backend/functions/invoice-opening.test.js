import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";

let fixture;
globalThis.__invoiceOpening = {
  createClient: () => ({
    connect: async () => {}, end: async () => {},
    query: async (sql, values) => {
      fixture.queries.push({ sql, values });
      if (sql.includes('FROM "booking" b')) return { rows: [fixture.booking], rowCount: 1 };
      if (sql.includes('FROM "order" o')) return { rows: [fixture.order], rowCount: 1 };
      if (sql.includes('FROM "orderItem"')) return { rows: fixture.items || [] };
      if (sql.includes('FROM "expense"') || sql.includes('FROM "bouncy_castles"')) return { rows: [] };
      throw new Error("Unexpected invoice fixture query");
    },
  }),
};
const urls = ["getInvoiceDetails.js", "generateInvoice.js"].map((file) => new URL(file, import.meta.url).href);
const mocks = new Map([
  ["./_shared/databaseClient.js", "export const createDatabaseClient = globalThis.__invoiceOpening.createClient;"],
  ["./_shared/internalApi.js", `export const requirePermission = async (_client, _event, permission) => {
    if (permission !== "invoices:read") throw new Error("Permission changed");
    return { organizationId: 7 };
  }; export const respond = (_event, statusCode, body) => ({statusCode, body: JSON.stringify(body)});`],
  ["./_shared/expenseAccounting.js", "export const resolveExpenseTable = async () => null; export const resolveExpenseColumns = async () => [];"],
  ["../modules/payments/payableRepository.js", "export const PAYABLE_TYPES = { BOOKING: 'BOOKING' }; export const getAppliedAmount = async () => 2500;"],
]);
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (urls.includes(context.parentURL) && mocks.has(specifier)) return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(mocks.get(specifier))}` };
  return next(specifier, context);
} });
const [{ handler: bookingInvoice }, { handler: orderInvoice }] = await Promise.all(urls.map((url) => import(url)));
hooks.deregister();
after(() => { delete globalThis.__invoiceOpening; });

test("booking invoice opens with recorded service fees, without requiring a current attendant rate", async () => {
  fixture = { queries: [], booking: { id: 4, totalAmount: 15000, feeCents: 5000,
    items: [{ productId: 3, quantity: 1, price: 10000, attendantsNeeded: 2 }] } };
  const response = await bookingInvoice({ queryStringParameters: { id: "4" } });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.feeCents, 5000);
  assert.equal(body.amountPaidCents, 2500);
  assert.equal(body.balanceDueCents, 12500);
  assert.deepEqual(body.expenses, [], "do not duplicate a recorded fee as a new expense");
  assert.deepEqual(fixture.queries[0].values, [4, 7]);
});

for (const method of ["pickup", "delivery"]) {
  test(`order invoice opens for ${method}, preserving saved totals without a current delivery rate`, async () => {
    fixture = { queries: [], order: { id: 5, orderNumber: "ORD-TEST", deliveryMethod: method,
      total_amount: 12500, grandTotalCents: 12500, deliveryFeeCents: method === "delivery" ? 2000 : 0,
      taxCents: 500, amountPaidCents: 2500, balanceDueCents: 10000 },
      items: [{ id: 1, quantity: 1, unit_price: 10000, total_amount: 10000, name: "Saved item" }] };
    const response = await orderInvoice({ queryStringParameters: { orderId: "5" } });
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.summary.grandTotal, 125);
    assert.equal(body.summary.taxTotal, 5);
    assert.equal(body.items.reduce((sum, item) => sum + item.totalCents, 0), 12000);
    assert.equal(body.balanceDueCents, 10000);
    assert.deepEqual(fixture.queries[0].values, [5, 7]);
    assert.ok(fixture.queries.every(({ sql }) => !/INSERT|UPDATE|DELETE/.test(sql)));
  });
}
