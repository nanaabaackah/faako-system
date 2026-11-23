// One-time isolated Cloudflare Pages bootstrap. Never writes CMS DB state,
// changes custom domains, alters Railway variables, or touches production.
// Run only in the existing staging worker environment with its current secrets.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDatabase, verifyDatabaseIdentity } from "../src/db/database.js";
import { PublicationRepository, manifestDigest } from "../src/content/publication.js";
import { ArtifactArchive } from "../src/content/artifact-archive.js";
import { PagesProvider, deploymentOriginForProject, readPagesConfiguration } from "../src/content/pages-provider.js";
import { verifyPublishedMarker } from "../src/content/artifact.js";
import { readR2Config, R2Store } from "../src/media/r2.js";

const TARGET_PROJECT = "twe-concierge-staging";
const TARGET_SUBDOMAIN = "https://twe-concierge-staging.pages.dev";
const usage = "Choose inspect (read-only) or deploy --confirm-isolated-bootstrap.";
const action = process.argv[2];
const mayDeploy = action === "deploy" && process.argv[3] === "--confirm-isolated-bootstrap";
if (!(action === "inspect" && process.argv.length === 3) && !mayDeploy) {
  console.error(usage);
  process.exit(2);
}
const settings = readPagesConfiguration();
if (settings.environment !== "staging" ||
    settings.origin !== "https://staging.travelwitheasegh.com" ||
    settings.branch !== "develop" || settings.project === TARGET_PROJECT)
  throw new Error("Bootstrap must run against the current, separate staging worker and source project.");
const organisationId = process.env.TWE_ORGANISATION_ID;
if (!/^[a-f0-9-]{36}$/i.test(organisationId || ""))
  throw new Error("Staging organisation identity is missing.");
const storage = readR2Config();
if (!storage) throw new Error("Staging private R2 archive is unavailable.");
const pool = createDatabase();
let temp;
try {
  await verifyDatabaseIdentity(pool, { environment: "staging", organisationId });
  const publication = new PublicationRepository(pool, { organisationId, environment: "staging", sourceSha: settings.sourceSha });
  const lastLive = await publication.lastLive();
  if (!lastLive) throw new Error("No confirmed staging Live publication exists.");
  if (!/^[a-f0-9-]{36}$/i.test(lastLive.deployment_id || ""))
    throw new Error("The old Live publication has no valid deployment reference.");
  const marker = { jobId: lastLive.id, sourceSha: lastLive.source_sha, digest: manifestDigest(lastLive.manifest) };
  temp = await mkdtemp(path.join(tmpdir(), "twe-pages-staging-bootstrap-"));
  const archive = new ArtifactArchive(new R2Store(storage), { organisationId, environment: "staging" });
  await archive.restore(lastLive.id, temp);
  const archived = JSON.parse(await readFile(path.join(temp, "twe-publication.json"), "utf8"));
  if (archived.jobId !== marker.jobId || archived.sourceSha !== marker.sourceSha ||
      archived.digest !== marker.digest)
    throw new Error("The private Live artifact does not match its persisted CMS publication.");
  const source = new PagesProvider(settings);
  const oldProject = await source.request();
  source.assertProject(oldProject);
  const oldDeployment = await source.request("/deployments/" + lastLive.deployment_id);
  if (oldDeployment.id !== lastLive.deployment_id ||
      oldDeployment.environment !== source.expectedDeploymentEnvironment() ||
      oldDeployment.latest_stage?.status !== "success" ||
      oldDeployment.deployment_trigger?.metadata?.branch !== "develop" ||
      oldDeployment.deployment_trigger?.metadata?.commit_hash !== lastLive.source_sha)
    throw new Error("Stored Live baseline lacks source Pages deployment proof.");
  await verifyPublishedMarker(deploymentOriginForProject(oldDeployment, oldProject, settings.project), marker);

  const target = new PagesProvider({ ...settings, project: TARGET_PROJECT });
  const targetProject = await target.request();
  target.assertProject(targetProject);
  if (targetProject.subdomain !== "twe-concierge-staging.pages.dev" ||
      target.expectedDeploymentEnvironment() !== "production")
    throw new Error("Dedicated staging project routing or branch identity differs from the reviewed target.");
  // Find the exact artifact on the new project before mutating anything.
  // A deploy call is never retried if its result is ambiguous.
  const existing = await target.request("/deployments?per_page=25");
  if (!Array.isArray(existing)) throw new Error("The dedicated project deployment list is invalid.");
  const candidates = existing.filter(item => item.environment === "production" &&
    item.latest_stage?.status === "success" &&
    item.deployment_trigger?.metadata?.branch === "develop" &&
    item.deployment_trigger?.metadata?.commit_hash === marker.sourceSha);
  let matched = [];
  for (const item of candidates) {
    try {
      const origin = deploymentOriginForProject(item, targetProject, TARGET_PROJECT);
      await verifyPublishedMarker(origin, marker);
      matched.push({ id: item.id, origin });
    } catch { /* A different artifact is not a verified baseline. */ }
  }
  if (matched.length > 1) throw new Error("Multiple matching Pages artifacts: review before continuing.");
  if (action === "inspect") {
    console.log(JSON.stringify({ stage: "inspection_complete", sourceProject: settings.project,
      targetProject: TARGET_PROJECT, baselineJobId: marker.jobId, sourceSha: marker.sourceSha,
      targetBaselineVerified: matched.length === 1, targetDeploymentId: matched[0]?.id || null,
      pendingJobPresent: Boolean(await publication.staleDeployment()),
      safeToSwitchDomain: false, note: "No configuration, CMS record, or DNS changes performed." }));
    process.exitCode = 0;
  } else {
    let deployment = matched[0];
    if (!deployment) {
      // An initial placeholder upload is never a CMS baseline.
      const deployed = await target.deploy(temp, { source_sha: lastLive.source_sha,
        startedAt: new Date().toISOString() });
      deployment = deployed;
      await verifyPublishedMarker(deployment.origin, marker);
    }
    // The target branch alias is the new project's production origin. Wait
    // read-only for propagation; do not retry an upload.
    let routed = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      try { await verifyPublishedMarker(TARGET_SUBDOMAIN, marker); routed = true; break; }
      catch {
        if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    if (!routed) throw new Error("New project immutable marker verified but production alias has not propagated; do not redeploy automatically.");
    console.log(JSON.stringify({ stage: "isolated_baseline_verified",
      targetProject: TARGET_PROJECT, deploymentId: deployment.id, baselineJobId: marker.jobId,
      pendingJobPresent: Boolean(await publication.staleDeployment()), safeToSwitchDomain: false,
      note: "Verified only on the dedicated Pages project. Existing staging domain, Railway target and CMS DB remain unchanged." }));
  }
} catch {
  console.error("Staging bootstrap proof failed. No CMS state, Railway variables, production or DNS were changed. Inspect the old source deployment, R2 archive and target Pages project.");
  process.exitCode = 1;
} finally {
  if (temp) await rm(temp, { recursive: true, force: true });
  await pool.end();
}
