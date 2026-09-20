import assert from "node:assert/strict";
import test from "node:test";

import { createReebsApiServer, validateDeployedRuntime } from "./server.js";

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

const listen = (app) => new Promise((resolve, reject) => {
  const server = app.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      reject(new Error("REEBS test server did not expose a TCP address."));
      return;
    }
    resolve({ server, port: address.port });
  });
  server.once("error", reject);
});

const close = (server) => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

test("versioned auth preflight reaches the compatibility handler", async (context) => {
  const { server, port } = await listen(createReebsApiServer());
  context.after(() => close(server));

  const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5174",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5174");
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
});
