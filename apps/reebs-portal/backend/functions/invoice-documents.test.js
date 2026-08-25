import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAuthoritativeInvoiceDeposit,
  validateCoreInvoiceProducts,
} from "./invoice-documents.js";

const configRow = (id, key, value) => ({
  id,
  organizationId: 7,
  businessUnit: "REEBS_CORE",
  key,
  value: String(value),
  valueType: key.endsWith("_bps") ? "BASIS_POINTS" : "INTEGER",
  effectiveFrom: "2026-08-01T00:00:00.000Z",
  effectiveTo: null,
  active: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
});

test("invoice deposit and default due date are server-calculated from effective Core config", async () => {
  const client = {
    async query(sql, params) {
      assert.match(sql, /FROM "commercialConfiguration"/);
      if (params[2] === "service_deposit_bps") {
        return { rows: [configRow(11, params[2], 7000)] };
      }
      if (params[2] === "service_deposit_due_days") {
        return { rows: [configRow(12, params[2], 2)] };
      }
      throw new Error(`Unexpected config key ${params[2]}`);
    },
  };

  const normalized = await applyAuthoritativeInvoiceDeposit(client, 7, {
    documentType: "invoice",
    issueDate: "2026-08-10",
    eventDate: "2026-08-20",
    dueDate: null,
    lineItems: [{ description: "Rental", quantity: 1, unitPrice: 100, total: 100 }],
    additionalItems: [],
    taxRate: 0,
    discountAmount: 0,
  }, { at: new Date("2026-08-15T12:00:00.000Z") });

  assert.equal(normalized.depositAmount, 70);
  assert.equal(normalized.dueDate, "2026-08-18");
});

test("receipt records never consult service-deposit configuration", async () => {
  const normalized = await applyAuthoritativeInvoiceDeposit({
    async query() {
      throw new Error("Receipt must not query commercial configuration.");
    },
  }, 7, {
    documentType: "receipt",
    depositAmount: 99,
  });

  assert.equal(normalized.depositAmount, 0);
});

test("REEBS Core invoices reject Water-category and Water-price-linked products", () => {
  const documentQuantities = new Map([[4, 1]]);
  assert.match(
    validateCoreInvoiceProducts({
      documentQuantities,
      productMap: new Map([[4, {
        id: 4,
        name: "15pk Gwater",
        sourceCategoryCode: "WATER",
        isWaterProduct: false,
      }]]),
    }),
    /Water Business/
  );
  assert.match(
    validateCoreInvoiceProducts({
      documentQuantities,
      productMap: new Map([[4, {
        id: 4,
        name: "Linked Water pack",
        sourceCategoryCode: "INVENTORY",
        isWaterProduct: true,
      }]]),
    }),
    /Water Business/
  );
  assert.equal(
    validateCoreInvoiceProducts({
      documentQuantities,
      productMap: new Map([[4, {
        id: 4,
        name: "Party cups",
        sourceCategoryCode: "INVENTORY",
        isWaterProduct: false,
      }]]),
    }),
    ""
  );
});
