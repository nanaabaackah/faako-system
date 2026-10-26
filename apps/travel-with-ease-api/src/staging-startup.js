import { assertLocalFoundation } from "./config.js";
import { readHostedPrerequisites, verifyHostedDatabase } from "./portal/readiness.js";
import { readAccessConfig } from "./auth/access-config.js";
import { accessAdapterDetails } from "./auth/routes.js";
import { PostgresAuthStore } from "./auth/store.js";
import { PostgresLeadRepository } from "./db/repository.js";

// Keep createApp synchronous for existing consumers. Only a successful async
// preflight can issue this process-local receipt; JSON/env flags cannot forge it.
const receipts = new WeakMap();
export async function prepareHostedStartup(env, pool) {
  const identity = readHostedPrerequisites(env);
  await verifyHostedDatabase(pool, identity);
  const receipt = Object.freeze({});
  receipts.set(receipt, { pool, identity, access: readAccessConfig(env), allowedOrigins: env.ALLOWED_ORIGINS.split(",").map(value => value.trim()).filter(Boolean) });
  return receipt;
}

// Compatibility for the original staging-only entry point.
export async function prepareStagingStartup(env, pool) {
  if (env.APP_ENV !== "staging") throw new Error("This entry point requires staging.");
  return prepareHostedStartup(env, pool);
}

export function assertApiStartup({ environment, repository, staffAuth, allowedOrigins, agentToken, startupReceipt }) {
  if (!["staging", "production"].includes(environment)) return assertLocalFoundation(environment);
  const verified = receipts.get(startupReceipt);
  const adapter = accessAdapterDetails(staffAuth);
  if (!verified || agentToken || !(repository instanceof PostgresLeadRepository) ||
      verified.identity.environment !== environment ||
      repository.pool !== verified.pool || repository.environment !== environment ||
      repository.organisationId !== verified.identity.organisationId ||
      !(adapter?.store instanceof PostgresAuthStore) ||
      adapter.store.pool !== verified.pool || adapter.store.organisationId !== verified.identity.organisationId ||
      adapter.settings.issuer !== verified.access.issuer || adapter.settings.audience !== verified.access.audience ||
      adapter.settings.portalOrigin !== verified.access.portalOrigin || !adapter.settings.secure ||
      JSON.stringify(allowedOrigins) !== JSON.stringify(verified.allowedOrigins)) {
    throw new Error("Hosted startup requires verified PostgreSQL, matching persistent Access sessions and explicit origins.");
  }
}
