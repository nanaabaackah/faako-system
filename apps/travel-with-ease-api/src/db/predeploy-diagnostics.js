import { DatabaseConfigurationError } from "./configuration-error.js";
import { ReadinessError } from "../portal/readiness.js";

// This module deliberately logs only developer-authored codes and guidance.
// Driver messages can contain usernames, hostnames, SQL or credentials; never
// print error.message, the error object, causes or connection strings.
const tlsCodes = new Set([
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "ERR_OSSL_PEM_NO_START_LINE",
  "ERR_OSSL_PEM_BAD_BASE64_DECODE",
]);
const networkCodes = new Set([
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND",
  "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH", "EPIPE",
]);
const appMessages = new Map([
  ["Fresh database requires explicit --initialise confirmation.", "database_initialisation_required"],
  ["Database environment or organisation does not match this application.", "database_identity_mismatch"],
  ["Migration history differs from this checkout; refusing to continue.", "migration_history_mismatch"],
  ["Out-of-order migrations are not allowed.", "migration_order_mismatch"],
]);

const guidance = Object.freeze({
  database_initialisation_required: "Check whether this is a genuinely new, empty production database. First-time schema initialisation must be separately approved; do not enable it on an existing database.",
  database_identity_mismatch: "Confirm the expected production database and organisation identity. Do not point staging and production at the same database.",
  migration_history_mismatch: "Compare reviewed migration files and the existing migration ledger. Do not edit migration history or reset the database.",
  migration_order_mismatch: "Reconcile the reviewed migration sequence before redeployment. Do not change previously applied migrations.",
  database_tls_hostname_mismatch: "The database certificate does not match the connected hostname. Check the certificate SAN and connection endpoint; do not disable TLS verification.",
  database_tls_trust_failed: "Inspect the trusted CA certificate and database server certificate for this environment. Preserve full TLS verification.",
  database_dns_unavailable: "Confirm the private database hostname resolves from the TWE API service in the same Railway project/environment.",
  database_connection_failed: "Check that production PostgreSQL is running and the host, port and private networking are reachable from the API service.",
  database_authentication_failed: "Check the migration-role login and password in TWE_MIGRATION_DATABASE_URL without sharing their values.",
  database_missing: "Confirm the intended production PostgreSQL database exists before running migrations.",
  database_permission_denied: "Check the migration role's schema ownership and granted permissions. Do not use the runtime role for migrations.",
  database_object_missing: "Check the existing schema and reviewed migration inventory; do not reset or recreate a live database.",
  database_sql_error: "A PostgreSQL SQL error occurred during migration. Inspect the reviewed migration and database state; do not retry destructive changes.",
  database_unavailable: "Inspect the production database service, private endpoint, migration role, TLS certificate and schema state. No reset or automatic retry is performed.",
});

// Bound recursion and fixed rules keep classified output independent of any
// provider-controlled error text, even if a driver wraps the original error.
function chain(error) {
  const seen = new Set();
  const pending = [error];
  const items = [];
  while (pending.length && items.length < 8) {
    const item = pending.shift();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    items.push(item);
    if (item.cause) pending.push(item.cause);
    if (Array.isArray(item.errors)) pending.push(...item.errors.slice(0, 4));
  }
  return items;
}

export function classifyPredeployFailure(error) {
  for (const item of chain(error)) {
    if (item instanceof DatabaseConfigurationError) {
      // DatabaseConfigurationError uses a fixed, developer-authored code and
      // message. A caller may report these directly, without error values.
      return { code: item.code, guidance: item.message };
    }
    if (item instanceof ReadinessError) {
      return { code: item.code, guidance: item.message };
    }
    const applicationCode = appMessages.get(item.message);
    if (applicationCode) {
      return { code: applicationCode, guidance: guidance[applicationCode] };
    }
  }
  for (const item of chain(error)) {
    const code = typeof item.code === "string" ? item.code : "";
    if (code === "ERR_TLS_CERT_ALTNAME_INVALID") return { code: "database_tls_hostname_mismatch", guidance: guidance.database_tls_hostname_mismatch };
    if (tlsCodes.has(code)) return { code: "database_tls_trust_failed", guidance: guidance.database_tls_trust_failed };
    if (["28P01", "28000"].includes(code)) return { code: "database_authentication_failed", guidance: guidance.database_authentication_failed };
    if (code === "3D000") return { code: "database_missing", guidance: guidance.database_missing };
    if (code === "42501") return { code: "database_permission_denied", guidance: guidance.database_permission_denied };
    if (["42P01", "3F000", "42704"].includes(code)) return { code: "database_object_missing", guidance: guidance.database_object_missing };
    if (code.startsWith("08")) return { code: "database_connection_failed", guidance: guidance.database_connection_failed };
    if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return { code: "database_dns_unavailable", guidance: guidance.database_dns_unavailable };
    if (networkCodes.has(code)) return { code: "database_connection_failed", guidance: guidance.database_connection_failed };
    if (/^[A-Z0-9]{5}$/.test(code) && /^[0-9A-Z]{2}$/.test(code.slice(0, 2))) {
      return { code: "database_sql_error", guidance: guidance.database_sql_error };
    }
  }
  return { code: "database_unavailable", guidance: guidance.database_unavailable };
}
