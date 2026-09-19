import assert from "node:assert/strict";
import test from "node:test";

import { validateDeployedRuntime } from "./server.js";

const VALID_DEPLOYED_CONFIGURATION = {
  databaseUrl: "postgresql://placeholder:placeholder@db.example.test:5432/reebs",
  userAppSecret: "placeholder-user-app-secret-at-least-32-characters",
};

test("development startup retains its local configuration behavior", () => {
  assert.doesNotThrow(() => validateDeployedRuntime({ appEnvironment: "development" }));
});

test("staging receives deployed startup safeguards and accepts Paystack test mode", () => {
  assert.doesNotThrow(() => validateDeployedRuntime({
    ...VALID_DEPLOYED_CONFIGURATION,
    appEnvironment: "staging",
    paystackSecretKey: "sk_test_placeholder",
  }));
  assert.throws(
    () => validateDeployedRuntime({
      ...VALID_DEPLOYED_CONFIGURATION,
      appEnvironment: "staging",
      paystackSecretKey: "sk_live_placeholder",
    }),
    /test credentials in staging/
  );
});

test("optional provider and Water credentials do not block staging startup", () => {
  assert.doesNotThrow(() => validateDeployedRuntime({
    ...VALID_DEPLOYED_CONFIGURATION,
    appEnvironment: "staging",
    paystackSecretKey: "",
  }));
});

test("production safeguards remain intact and reject Paystack test mode", () => {
  assert.throws(
    () => validateDeployedRuntime({
      ...VALID_DEPLOYED_CONFIGURATION,
      appEnvironment: "production",
      paystackSecretKey: "sk_test_placeholder",
    }),
    /live credentials in production/
  );
  assert.throws(
    () => validateDeployedRuntime({
      appEnvironment: "production",
      databaseUrl: "",
      userAppSecret: "",
      paystackSecretKey: "",
    }),
    /DATABASE_URL/
  );
});
