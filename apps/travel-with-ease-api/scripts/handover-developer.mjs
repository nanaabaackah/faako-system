// Explicit administrative operation. Both Access assertions enter through stdin only.
import { randomUUID } from "node:crypto";
import { readAccessConfig } from "../src/auth/access-config.js";
import { createAccessVerifier } from "../src/auth/access.js";
import { createDatabase } from "../src/db/database.js";
import { validateEnvironment } from "../src/config.js";
import { handoverDeveloper } from "../src/auth/handover.js";

const [approvalReference, confirmation] = process.argv.slice(2);
if (
  confirmation !== "--approved-handover" ||
  process.argv.length !== 4 ||
  !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(approvalReference || "")
)
  throw new Error("Provide an approved reference and --approved-handover.");
let input = "",
  pool;
try {
  const environment = validateEnvironment(
    process.env.APP_ENV,
    process.env.NODE_ENV,
  );
  const settings = readAccessConfig();
  if (!settings) throw new Error("Access is required.");
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 33000) throw new Error("Input too large.");
  }
  const assertions = JSON.parse(input);
  input = "";
  if (
    Object.keys(assertions).sort().join(",") !==
    "clientAssertion,developerAssertion"
  )
    throw new Error("Two assertions are required.");
  const verifier = createAccessVerifier(settings);
  const developer = await verifier.verify(assertions.developerAssertion),
    client = await verifier.verify(assertions.clientAssertion);
  pool = createDatabase(process.env, "TWE_MIGRATION_DATABASE_URL");
  await handoverDeveloper(pool, {
    environment,
    organisationId: process.env.TWE_ORGANISATION_ID,
    settings,
    developer,
    client,
    approvalReference,
    requestId: randomUUID(),
  });
  console.log("Reviewed handover completed. Both users must sign in again.");
} catch {
  console.error(
    "Handover not confirmed. Review verified identities, approval and database state; no reset or automatic retry was attempted.",
  );
  process.exitCode = 1;
} finally {
  input = "";
  await pool?.end();
}
