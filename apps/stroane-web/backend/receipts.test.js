import assert from "node:assert/strict";
import test from "node:test";
import { ensureReceiptForOrder, sendReceiptForPaidOrder } from "./src/receipts/service.js";

const buildOrder = (overrides = {}) => ({
  id: "order-1",
  orderNumber: "STR-20260619-TEST",
  status: "PAYMENT_PENDING",
  customerName: "Nana",
  customerEmail: "nana@example.com",
  customerPhone: "+233555000000",
  deliveryAddress: "Accra",
  currency: "GHS",
  subtotal: 250,
  total: 250,
  paymentStatus: "not_started",
  paymentReference: null,
  items: [
    {
      id: "item-1",
      productSlug: "priced-product",
      productName: "Priced Product",
      sku: "STR-PRICED",
      quantity: 2,
      unitPrice: 125,
      lineTotal: 250,
      currency: "GHS",
    },
  ],
  ...overrides,
});

const createReceiptPrisma = (order) => {
  const receipts = [];
  const withOrder = (receipt) =>
    receipt
      ? {
          ...receipt,
          order,
        }
      : null;

  return {
    receipts,
    commerceReceipt: {
      count: async ({ where } = {}) =>
        receipts.filter((receipt) => !where?.orderId || receipt.orderId === where.orderId).length,
      findUnique: async ({ where } = {}) => {
        if (where?.receiptNumber) {
          return receipts.find((receipt) => receipt.receiptNumber === where.receiptNumber) || null;
        }
        if (where?.id) return withOrder(receipts.find((receipt) => receipt.id === where.id));
        return null;
      },
      findFirst: async ({ where } = {}) =>
        withOrder(receipts.find((receipt) => receipt.orderId === where?.orderId)),
      create: async ({ data } = {}) => {
        const receipt = {
          id: `receipt-${receipts.length + 1}`,
          issuedAt: new Date("2026-06-19T12:00:00Z"),
          sentAt: null,
          downloadedAt: null,
          resendStatus: null,
          resendProviderId: null,
          resendError: null,
          createdAt: new Date("2026-06-19T12:00:00Z"),
          updatedAt: new Date("2026-06-19T12:00:00Z"),
          ...data,
        };
        receipts.push(receipt);
        return withOrder(receipt);
      },
      update: async ({ where, data } = {}) => {
        const receipt = receipts.find((item) => item.id === where?.id);
        if (!receipt) throw new Error("Receipt not found.");
        Object.assign(receipt, data, { updatedAt: new Date("2026-06-19T12:05:00Z") });
        return withOrder(receipt);
      },
    },
  };
};

test("order creation automatically creates one awaiting-payment receipt", async () => {
  const order = buildOrder();
  const prisma = createReceiptPrisma(order);

  const first = await ensureReceiptForOrder(prisma, order, {
    notes: "Automatically created when the order was submitted.",
  });
  const second = await ensureReceiptForOrder(prisma, order);

  assert.equal(prisma.receipts.length, 1);
  assert.equal(first.status, "created");
  assert.equal(second.status, "existing");
  assert.equal(first.receipt.status, "awaiting_payment");
  assert.equal(first.receipt.paymentStatus, "not_started");
  assert.match(first.receipt.receiptNumber, /^RCPT-STR-20260619-TEST-01$/);
});

test("paid orders sync the receipt and attempt customer-safe email once", async () => {
  const previousApiKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  try {
    const order = buildOrder();
    const prisma = createReceiptPrisma(order);
    await ensureReceiptForOrder(prisma, order);

    const paidOrder = buildOrder({
      status: "PAID",
      paymentStatus: "paid",
      paymentReference: "STR-PAYSTACK-REF",
      paidAt: new Date("2026-06-19T12:10:00Z"),
    });
    const result = await sendReceiptForPaidOrder(prisma, paidOrder);

    assert.equal(prisma.receipts.length, 1);
    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "resend_not_configured");
    assert.equal(result.receipt.status, "issued");
    assert.equal(result.receipt.paymentStatus, "paid");
    assert.equal(result.receipt.paymentReference, "STR-PAYSTACK-REF");
    assert.equal(result.receipt.resendStatus, "skipped");
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = previousApiKey;
    }
  }
});
