import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateServiceDepositAmount,
  calculateServiceDepositDueDate,
  preservePersistedInvoiceTerms,
  shouldRefreshDraftDeposit,
} from "./invoiceCommercialTerms.js";

test("service deposit uses configured basis points with major-unit rounding", () => {
  assert.equal(calculateServiceDepositAmount(123.45, 7000), 86.42);
  assert.equal(calculateServiceDepositAmount(123.45, 0), 0);
  assert.throws(() => calculateServiceDepositAmount(100, -1), /valid/);
});

test("configured due days apply before an event or after an issue date", () => {
  assert.equal(
    calculateServiceDepositDueDate({ eventDate: "2026-08-20", issueDate: "2026-08-01" }, 2),
    "2026-08-18"
  );
  assert.equal(
    calculateServiceDepositDueDate({ issueDate: "2026-08-20" }, 2),
    "2026-08-22"
  );
});

test("only unsent drafts are eligible for authoritative deposit refresh", () => {
  assert.equal(shouldRefreshDraftDeposit({ documentType: "invoice", paymentStatus: "draft" }), true);
  assert.equal(shouldRefreshDraftDeposit({ documentType: "invoice", paymentStatus: "unpaid" }), false);
  assert.equal(shouldRefreshDraftDeposit({ documentType: "receipt", paymentStatus: "draft" }), false);
  assert.equal(
    shouldRefreshDraftDeposit({ documentType: "invoice", paymentStatus: "draft", sentAt: "2026-08-20" }),
    false
  );
});

test("issued invoice deposit and due-date snapshots ignore later client replacements", () => {
  const preserved = preservePersistedInvoiceTerms(
    { depositAmount: "70.00", dueDate: "2026-08-18" },
    { depositAmount: 15, dueDate: "2026-09-30", notes: "Keep this edit" }
  );

  assert.equal(preserved.depositAmount, "70.00");
  assert.equal(preserved.dueDate, "2026-08-18");
  assert.equal(preserved.notes, "Keep this edit");
});
