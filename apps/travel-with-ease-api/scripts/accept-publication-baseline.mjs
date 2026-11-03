// One-time technical acceptance, not a routine staff publishing requirement.
// Preparation never deploys; confirmation requires exact deployed marker proof.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { createDatabase, verifyDatabaseIdentity } from "../src/db/database.js";
import { PublicationRepository, manifestDigest } from "../src/content/publication.js";
import { PagesProvider, readPagesConfiguration } from "../src/content/pages-provider.js";
import { ArtifactArchive } from "../src/content/artifact-archive.js";
import { preparePublication, verifyPublishedMarker } from "../src/content/artifact.js";
import { publicBuildEnvironment, runReviewedCommand } from "../src/content/build.js";
import { readR2Config, R2Store } from "../src/media/r2.js";
import { MediaService } from "../src/media/service.js";
import { verifyHostedDatabase } from "../src/portal/readiness.js";

const settings = readPagesConfiguration();
const pool = createDatabase();
let directory, retained = false;
try {
  const organisationId = process.env.TWE_ORGANISATION_ID;
  await verifyDatabaseIdentity(pool, { environment: settings.environment, organisationId });
  await verifyHostedDatabase(pool, { environment: settings.environment, organisationId });
  const storage = readR2Config();
  if (!storage) throw new Error();
  const store = new R2Store(storage), archive = new ArtifactArchive(store, { organisationId, environment: settings.environment });
  const publication = new PublicationRepository(pool, { organisationId, environment: settings.environment, sourceSha: settings.sourceSha });
  if (await publication.lastLive()) throw new Error("Baseline already accepted.");
  const sha = await runReviewedCommand("git", ["rev-parse", "HEAD"], { PATH: process.env.PATH });
  if (sha !== settings.sourceSha || await runReviewedCommand("git", ["status", "--porcelain", "--", "apps/travel-with-ease-api", "apps/travel-with-ease-web", "packages", "package.json", "pnpm-lock.yaml"], { PATH: process.env.PATH })) throw new Error();
  if (process.argv[2] === "prepare") {
    const job = await publication.claim();
    if (!job || job.source_sha !== sha) throw new Error();
    try {
      directory = await mkdtemp(path.join(tmpdir(), "twe-initial-publication-"));
      const artifact = await preparePublication(job, new MediaService(pool, organisationId, store), directory, { approvedBaseline: true });
      const out = path.join(directory, "dist");
      await runReviewedCommand("pnpm", ["--filter", "@faako/travel-with-ease-web", "run", "build"], publicBuildEnvironment({
        environment: settings.environment, siteOrigin: settings.origin, apiOrigin: process.env.TWE_PUBLIC_API_ORIGIN || "",
        turnstileSiteKey: process.env.TWE_PUBLIC_TURNSTILE_SITE_KEY || "", snapshot: artifact.snapshot,
        publicDirectory: artifact.publicDirectory, out, indexable: settings.environment === "production" && process.env.TWE_PUBLIC_SITE_INDEXABLE === "true",
        sourceSha: job.source_sha, googleVerification: process.env.TWE_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
      }));
      await archive.retain(job.id, out); retained = true;
      console.log(JSON.stringify({ jobId: job.id, artifactDirectory: out, status: "built_not_deployed", project: settings.project, branch: settings.branch }));
    } catch { await publication.fail(job.id, job.build_token); throw new Error(); }
  } else if (process.argv[2] === "confirm") {
    const id = z.string().uuid().parse(process.argv[3]), deploymentId = z.string().uuid().parse(process.argv[4]);
    const { rows } = await pool.query("SELECT * FROM twe.publication_jobs WHERE id=$1 AND organisation_id=$2 AND environment=$3 AND status='building'", [id, organisationId, settings.environment]);
    const job = rows[0]; if (!job || job.source_sha !== sha) throw new Error();
    const provider = new PagesProvider(settings), deployed = await provider.request(`/deployments/${deploymentId}`);
    const url = new URL(deployed.url);
    if (!url.hostname.endsWith(`.${settings.project}.pages.dev`) || url.protocol !== "https:" || url.origin !== deployed.url || deployed.latest_stage?.status !== "success" || deployed.deployment_trigger?.metadata?.branch !== settings.branch || deployed.deployment_trigger?.metadata?.commit_hash !== sha || deployed.environment !== (settings.environment === "staging" ? "preview" : "production")) throw new Error();
    const marker = { jobId: id, sourceSha: sha, digest: manifestDigest(job.manifest) };
    directory = await mkdtemp(path.join(tmpdir(), "twe-baseline-verification-"));
    await archive.restore(id, directory);
    const archived = JSON.parse(await readFile(path.join(directory, "twe-publication.json"), "utf8"));
    if (archived.jobId !== marker.jobId || archived.sourceSha !== marker.sourceSha || archived.digest !== marker.digest) throw new Error();
    await verifyPublishedMarker(deployed.url, marker); await verifyPublishedMarker(settings.origin, marker);
    await publication.confirm(id, job.build_token, deploymentId, marker.digest);
    console.log(JSON.stringify({ jobId: id, status: "baseline_accepted" }));
  } else throw new Error();
} catch {
  console.error("Initial publication acceptance did not complete. Review source, environment, private archive and exact deployment marker. No live status was assumed.");
  process.exitCode = 1;
} finally {
  if (directory && !retained) await rm(directory, { recursive: true, force: true });
  await pool.end();
}
