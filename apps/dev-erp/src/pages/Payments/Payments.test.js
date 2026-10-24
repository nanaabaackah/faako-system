import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Payments workspace exposes standalone, delivery, receipt, retry, and reconciliation controls", async () => {
  const source = await read("./Payments.jsx");
  for (const marker of [
    "Create payment request",
    "Generate Paystack link",
    "Send link",
    "Cancel unpaid request",
    "Retry",
    "Receipt PDF",
    "Email receipt",
    "Reconcile to invoice",
    "Reconciliation",
  ]) assert.match(source, new RegExp(marker));
  assert.match(source, /api\/payments\/reconciliation-exceptions/);
  assert.match(source, /Idempotency-Key/);
  assert.match(source, /payment-link-email/);
});

test("payment return screen distinguishes verified, pending, failed, and unable states", async () => {
  const source = await read("./PaymentStatus.jsx");
  assert.match(source, /Payment confirmed/);
  assert.match(source, /Payment is still processing/);
  assert.match(source, /Payment not completed/);
  assert.match(source, /We could not verify this payment/);
  assert.match(source, /receiptAvailable/);
});

test("Paystack routes are registered without changing the public invoice route", async () => {
  const app = await read("../../App.jsx");
  const modules = await read("../../config/adminModules.js");
  assert.match(app, /path="\/payment\/status"/);
  assert.match(app, /path="\/payments"/);
  assert.match(app, /path="\/invoice\/view\/:token"/);
  assert.match(modules, /key: "payment-requests"/);
  assert.match(modules, /requiredPermission: "invoicing"/);
});
