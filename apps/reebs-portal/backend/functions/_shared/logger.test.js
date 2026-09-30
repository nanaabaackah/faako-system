import assert from "node:assert/strict";
import test from "node:test";

import { createLogger } from "./logger.js";

test("structured logger includes operational fields and redacts secrets", () => {
  const original = console.error;
  let output = "";
  console.error = (value) => { output = value; };
  try {
    createLogger("test-component").error({
      requestId: "request-1",
      password: "do-not-log",
      err: new Error("failed postgresql://user:pass@internal.example/db"),
    }, "operation failed");
  } finally {
    console.error = original;
  }

  const record = JSON.parse(output);
  assert.equal(record.level, 50);
  assert.equal(record.application, "reebs-portal");
  assert.equal(record.component, "test-component");
  assert.equal(record.environment, process.env.APP_ENV || process.env.NODE_ENV || "development");
  assert.equal(record.requestId, "request-1");
  assert.equal(record.password, "[REDACTED]");
  assert.doesNotMatch(output, /do-not-log|user:pass|internal\.example/);
  assert.match(record.error, /\[REDACTED\]/);
});
