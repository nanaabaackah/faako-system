import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { manifestDigest } from "./publication.js";
import { preparePublication, verifyPublishedMarker } from "./artifact.js";
import { publicBuildEnvironment, runReviewedCommand } from "./build.js";

export async function publishOne({ publication, media, provider, archive, settings, prepare = preparePublication,
  run = runReviewedCommand, verify = verifyPublishedMarker, logger = {} }) {
  // Validate the reviewed source before claiming a job; never build newer code
  // just because it happens to be deployed on Railway.
  const sha = await run("git", ["rev-parse", "HEAD"], { PATH: process.env.PATH });
  if (sha !== settings.sourceSha) throw new Error("Worker source does not match the approved release.");
  const dirty = await run("git", ["status", "--porcelain", "--", "apps/travel-with-ease-api", "apps/travel-with-ease-web", "packages", "package.json", "pnpm-lock.yaml"], { PATH: process.env.PATH });
  if (dirty) throw new Error("Publication requires a clean reviewed checkout.");
  const job = await publication.claim();
  if (!job) return { status: "idle" };
  let directory, previous, recovery, recoveryDirectory, deploymentStarted = false, deployed, confirmed = false, confirmationStarted = false;
  try {
    if (job.source_sha !== sha || job.environment !== settings.environment) throw new Error("Queued release identity does not match this worker.");
    previous = await provider.previous();
    directory = await mkdtemp(path.join(tmpdir(), "twe-publication-worker-"));
    if (settings.environment === "staging") {
      recovery = await publication.lastLive();
      if (!archive || !recovery || recovery.deployment_id !== previous.id) throw new Error("Staging requires an accepted, archived baseline matching its current preview deployment.");
      recoveryDirectory = path.join(directory, "recovery");
      await archive.restore(recovery.id, recoveryDirectory);
    }
    const artifact = await prepare(job, media, directory, { approvedBaseline: true });
    const out = path.join(directory, "dist");
    await run("pnpm", ["--filter", "@faako/travel-with-ease-web", "run", "build"], publicBuildEnvironment({
      environment: settings.environment, siteOrigin: settings.origin, apiOrigin: settings.apiOrigin,
      turnstileSiteKey: settings.turnstileSiteKey, indexable: settings.environment === "production" && settings.indexable === true,
      sourceSha: job.source_sha, googleVerification: settings.googleVerification || "",
      snapshot: artifact.snapshot, publicDirectory: artifact.publicDirectory, out,
    }));
    if (archive) await archive.retain(job.id, out);
    await publication.transition(job.id, job.build_token, "building", "deploying");
    deploymentStarted = true;
    deployed = await provider.deploy(out, { ...job, startedAt: new Date().toISOString() });
    await publication.transition(job.id, job.build_token, "deploying", "verifying");
    // Verify both the immutable deployment and the public custom domain.
    await verify(deployed.origin, artifact.marker);
    await verify(settings.origin, artifact.marker);
    confirmationStarted = true;
    await publication.confirm(job.id, job.build_token, deployed.id, manifestDigest(job.manifest));
    confirmed = true;
    return { id: job.id, status: "live", deploymentId: deployed.id };
  } catch {
    if (confirmationStarted) {
      try {
        const id = await publication.confirmed(job.id, manifestDigest(job.manifest));
        if (id) return { id: job.id, status: "live", deploymentId: id };
      } catch {
        logger.error?.({ eventName: "publication.confirmation_uncertain", jobId: job.id }, "Reconcile the active publication before retrying.");
        return { id: job.id, status: "verifying" };
      }
    }
    if (deploymentStarted && !deployed) {
      // A timed-out upload can still finish at the provider. Do not race it
      // with a rollback or permit a second publication to overtake it.
      logger.error?.({ eventName: "publication.deployment_uncertain", jobId: job.id }, "Provider deployment requires reconciliation; no retry was attempted.");
      return { id: job.id, status: "deploying" };
    }
    if (deploymentStarted && !confirmed) {
      try {
        if (settings.environment === "staging") {
          const recovered = await provider.deploy(recoveryDirectory, { source_sha: recovery.source_sha, startedAt: new Date().toISOString() });
          const marker = { jobId: recovery.id, sourceSha: recovery.source_sha, digest: manifestDigest(recovery.manifest) };
          await verify(recovered.origin, marker); await verify(settings.origin, marker);
          await publication.recovered(recovery.id, recovered.id);
        } else await provider.rollback(previous);
      }
      catch {
        logger.error?.({ eventName: "publication.rollback_required", jobId: job.id }, "Provider recovery needs operator review.");
        return { id: job.id, status: "verifying" };
      }
    }
    await publication.fail(job.id, job.build_token);
    return { id: job.id, status: "failed" };
  } finally { if (directory) await rm(directory, { recursive: true, force: true }); }
}
