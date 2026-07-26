import assert from "node:assert/strict";
import test from "node:test";
import { forgotPasswordInputSchema } from "@faako/validation";
import { forgotPasswordSchema } from "./schemas.js";

test("Dev ERP forgot-password validation uses the shared schema", () => {
  assert.equal(forgotPasswordSchema, forgotPasswordInputSchema);
});

test("forgot-password pilot preserves accepted and rejected inputs", () => {
  assert.deepEqual(
    forgotPasswordSchema.parse({ email: "person@example.com" }),
    { email: "person@example.com" },
  );
  assert.equal(
    forgotPasswordSchema.safeParse({ email: "not-an-email" }).success,
    false,
  );
  assert.equal(
    forgotPasswordSchema.safeParse({ email: "person@example.com", extra: true })
      .success,
    true,
  );
});
