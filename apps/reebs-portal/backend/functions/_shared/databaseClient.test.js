import assert from "node:assert/strict";
import test from "node:test";
import { createDatabaseClient, isDatabaseConnectionError } from "./databaseClient.js";

test("database connection failures are identified without treating application errors as connection failures", () => {
  assert.equal(isDatabaseConnectionError(new Error("Connection terminated unexpectedly")), true);
  assert.equal(
    isDatabaseConnectionError(new Error("Client has encountered a connection error and is not queryable")),
    true
  );
  assert.equal(isDatabaseConnectionError({ code: "ECONNRESET", message: "reset" }), true);
  assert.equal(isDatabaseConnectionError(new Error("Invalid booking transition")), false);
});

test("database clients handle emitted socket errors instead of crashing the process", () => {
  const errors = [];
  const client = createDatabaseClient({
    component: "database-client-test",
    onConnectionError: (error) => errors.push(error),
  });
  const connectionError = new Error("Connection terminated unexpectedly");

  assert.doesNotThrow(() => client.emit("error", connectionError));
  assert.deepEqual(errors, [connectionError]);
});
