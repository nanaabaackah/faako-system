import { createDatabase } from "../src/db/database.js";
import { readHostedPrerequisites, verifyHostedDatabase } from "../src/portal/readiness.js";

let pool;
try {
  const identity = readHostedPrerequisites(process.env);
  pool = createDatabase(process.env);
  const result = await verifyHostedDatabase(pool, identity);
  console.log(JSON.stringify({ ...result, liveAccessPolicyVerified: false, hostedStartupRequiresPreflight: true }));
} catch {
  // Deliberately omit connection strings, driver errors and private environment data.
  console.error("Hosted preflight failed. Check environment, Access configuration, runtime database role, identity and migration inventory. No changes were applied.");
  process.exitCode = 1;
} finally { if (pool) await pool.end(); }
