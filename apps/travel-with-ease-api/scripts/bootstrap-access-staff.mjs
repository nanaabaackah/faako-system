// Run only from an authorised administrative shell. JWT is read from stdin,
// never an argument, environment variable, log, browser token or persisted file.
import { randomUUID } from "node:crypto";
import { readAccessConfig } from "../src/auth/access-config.js";
import { createAccessVerifier } from "../src/auth/access.js";
import { createDatabase, transaction, verifyDatabaseIdentity } from "../src/db/database.js";
import { appendAudit } from "../src/audit.js";
import { validateEnvironment } from "../src/config.js";

const [role, expectedSubject, approvalReference, confirmation] = process.argv.slice(2);
if (!["platform_admin","owner"].includes(role) || !expectedSubject || expectedSubject.length>255 ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(approvalReference || "") || confirmation !== "--approved-bootstrap") throw new Error("Provide role, independently verified subject, approval reference and --approved-bootstrap.");
const settings=readAccessConfig();
if (!settings) throw new Error("Access configuration is required.");
const environment=validateEnvironment(process.env.APP_ENV,process.env.NODE_ENV);
let assertion="";
for await (const chunk of process.stdin) { assertion+=chunk; if (assertion.length>16385) throw new Error("Assertion too large."); }
let identity;
try { identity=await createAccessVerifier(settings).verify(assertion.trim()); }
catch { throw new Error("Access identity could not be verified."); }
assertion="";
if (identity.subject!==expectedSubject || (role==="platform_admin" && identity.email!=="dev.nanaabaackah@gmail.com")) throw new Error("Verified identity does not match the reviewed bootstrap subject.");
const pool=createDatabase(process.env,"TWE_MIGRATION_DATABASE_URL");
try {
  await transaction(pool,async client=> {
    await verifyDatabaseIdentity(client,{environment,organisationId:process.env.TWE_ORGANISATION_ID});
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('twe-invitations:' || $1, 0))",[process.env.TWE_ORGANISATION_ID]);
    await client.query("SELECT id FROM twe.organisations WHERE id=$1 FOR UPDATE",[process.env.TWE_ORGANISATION_ID]);
    const existing=await client.query("SELECT id FROM twe.staff_users WHERE organisation_id=$1 AND role=$2",[process.env.TWE_ORGANISATION_ID,role]);
    if (existing.rowCount) throw new Error("Initial role already exists; use a separately reviewed identity/recovery migration.");
    const id=randomUUID();
    await client.query("INSERT INTO twe.staff_users(id,organisation_id,issuer,subject,access_audience,role) VALUES($1,$2,$3,$4,$5,$6)",[id,process.env.TWE_ORGANISATION_ID,identity.issuer,identity.subject,identity.audience,role]);
    await appendAudit(client,{organisationId:process.env.TWE_ORGANISATION_ID,actorId:id,action:`staff.bootstrap.${role}`,recordId:id,requestId:approvalReference});
  });
  console.log("Reviewed staff bootstrap recorded. No session issued.");
} finally {await pool.end();}
