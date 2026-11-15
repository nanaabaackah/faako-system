import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { classifyPredeployFailure } from "../src/db/predeploy-diagnostics.js";
import { DatabaseConfigurationError } from "../src/db/configuration-error.js";
import { ReadinessError } from "../src/portal/readiness.js";

const cases = [
  ["ERR_TLS_CERT_ALTNAME_INVALID", "database_tls_hostname_mismatch"],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "database_tls_trust_failed"],
  ["SELF_SIGNED_CERT_IN_CHAIN", "database_tls_trust_failed"],
  ["ERR_OSSL_PEM_NO_START_LINE", "database_tls_trust_failed"],
  ["ENOTFOUND", "database_dns_unavailable"],
  ["EAI_AGAIN", "database_dns_unavailable"],
  ["ECONNREFUSED", "database_connection_failed"],
  ["ETIMEDOUT", "database_connection_failed"],
  ["08006", "database_connection_failed"],
  ["28P01", "database_authentication_failed"],
  ["28000", "database_authentication_failed"],
  ["3D000", "database_missing"],
  ["42501", "database_permission_denied"],
  ["42P01", "database_object_missing"],
  ["3F000", "database_object_missing"],
  ["42601", "database_sql_error"],
  ["23505", "database_sql_error"],
];

test("classifies PostgreSQL, network and TLS failures with safe bounded guidance", () => {
  const secret = "PRIVATE_CONNECTION_PASSWORD_SHOULD_NOT_APPEAR";
  for (const [code, expected] of cases) {
    const input = Object.assign(new Error(`database error: ${secret}`), { code, detail: secret, host: secret });
    const result = classifyPredeployFailure(input);
    assert.equal(result.code, expected);
    assert.ok(result.guidance.length > 20);
    assert.ok(!JSON.stringify(result).includes(secret));
  }
});

test("recognises developer-owned migration failures without echoing SQL or secrets", () => {
  const messages = new Map([
    ["Fresh database requires explicit --initialise confirmation.", "database_initialisation_required"],
    ["Database environment or organisation does not match this application.", "database_identity_mismatch"],
    ["Migration history differs from this checkout; refusing to continue.", "migration_history_mismatch"],
    ["Out-of-order migrations are not allowed.", "migration_order_mismatch"],
  ]);
  for (const [message, code] of messages) assert.equal(classifyPredeployFailure(new Error(message)).code, code);
  const privateError = new Error("failed at secret schema with password=secret");
  assert.equal(classifyPredeployFailure(privateError).code, "database_unavailable");
  assert.ok(!JSON.stringify(classifyPredeployFailure(privateError)).includes("secret"));
});

test("supports known configuration/readiness types and wrapped root causes", () => {
  assert.equal(classifyPredeployFailure(new DatabaseConfigurationError("migration_url_invalid")).code, "migration_url_invalid");
  assert.equal(classifyPredeployFailure(new ReadinessError("migration_inventory_mismatch", "Reviewed migrations differ.")).code, "migration_inventory_mismatch");
  const nested = new Error("never output url=postgresql://secret");
  nested.cause = Object.assign(new Error("inner contains secret"), {code: "28P01"});
  assert.equal(classifyPredeployFailure(nested).code, "database_authentication_failed");
  const aggregated = new AggregateError([Object.assign(new Error("secret"), {code:"ERR_TLS_CERT_ALTNAME_INVALID"})], "secret");
  assert.equal(classifyPredeployFailure(aggregated).code, "database_tls_hostname_mismatch");
});

test("pre-deploy refuses unsafe/missing environment without printing credentials", () => {
  const base = fileURLToPath(new URL("../", import.meta.url));
  const secret = "DO_NOT_LOG_PRIVATE_VALUE";
  const script = path.join(base, "scripts/deploy-database.mjs");
  const result = spawnSync(process.execPath, [script], {
    cwd: base,
    encoding: "utf8",
    timeout: 10000,
    env: {
      APP_ENV: "production",
      NODE_ENV: "production",
      TWE_MIGRATION_APPROVED_ENV: "staging",
      DATABASE_URL: "postgresql://runtime:" + secret + "@db.example/twe",
      TWE_MIGRATION_DATABASE_URL: "postgresql://migrator:" + secret + "@db.example/twe",
      PATH: process.env.PATH,
      LOG_LEVEL: "info",
    },
  });
  assert.equal(result.status, 1, result.error?.message);
  const logs = result.stdout + result.stderr;
  assert.match(logs, /migration_approval_mismatch/);
  assert.doesNotMatch(logs, /DO_NOT_LOG_PRIVATE_VALUE|postgresql:\/\//);
});
