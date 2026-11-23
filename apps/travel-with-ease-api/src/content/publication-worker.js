import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { manifestDigest } from "./publication.js";
import { preparePublication, verifyPublishedMarker } from "./artifact.js";
import { publicBuildEnvironment, runReviewedCommand } from "./build.js";
import { assertPublicationSource } from "./source-identity.js";

// Recover only a stale job whose exact artifact is already verifiably live.
// If provider evidence is missing/ambiguous, leave the database and live site
// untouched; never unblock another publish by guessing.
export async function reconcileStalePublication({ publication, provider, verify = verifyPublishedMarker, logger = {} }) {
  const job = await publication.staleDeployment?.();
  if (!job) return null;
  const digest = manifestDigest(job.manifest);
  const marker = { jobId: job.id, sourceSha: job.source_sha, digest };
  try {
    const deployed = await provider.findPublicationDeployment(job, verify, marker, logger);
    if (!deployed) throw new Error("No unique verified Pages deployment.");
    await publication.confirmReconciled(job.id, job.build_token, deployed.id, digest);
    logger.info?.({ eventName: "publication.deployment_reconciled", jobId: job.id, deploymentId: deployed.id }, "Previously deployed publication confirmed.");
    return { id: job.id, status: "live", deploymentId: deployed.id };
  } catch {
    // The concurrent worker may have confirmed the same job just now.
    try {
      const deployedId = await publication.confirmed(job.id, digest);
      if (deployedId) return { id: job.id, status: "live", deploymentId: deployedId };
    } catch {
      // A DB read failure is not evidence that the deployment is live.
    }
    logger.error?.({ eventName: "publication.reconciliation_required", jobId: job.id }, "A stale publication requires deployment evidence before another publication can begin.");
    return { id: job.id, status: "recovery_required" };
  }
}

export async function publishOne({ publication, media, provider, archive, settings, prepare = preparePublication,
  run = runReviewedCommand, verify = verifyPublishedMarker, logger = {} }) {
  // Validate the reviewed source before claiming a job; never build newer code
  // just because it happens to be deployed on Railway.
  const sha = await assertPublicationSource(settings.sourceSha, { run });
  const reconciled = await reconcileStalePublication({ publication, provider, verify, logger });
  if (reconciled) return reconciled;
  await publication.coordinateSource?.();
  const job = await publication.claim();
  if (!job) return { status: "idle" };
  let directory, previous, recovery, recoveryDirectory, deploymentStarted = false, deployed, confirmed = false, confirmationStarted = false;
  // Only predefined stages and reasons are recorded; provider errors, tokens,
  // asset keys, and arbitrary exception messages must never reach worker logs.
  let stage = "source_identity";
  try {
    if (job.source_sha !== sha || job.environment !== settings.environment) throw new Error("Queued release identity does not match this worker.");
    if (settings.environment === "staging") {
      stage = "baseline_validation";
      recovery = await publication.lastLive();
      if (!archive || !recovery) {
        const reason = !archive ? "archive_unavailable" : "no_live_baseline";
        logger.warn?.({ eventName: "publication.baseline_rejected", jobId: job.id, reason },
          "Staging requires a retained, confirmed CMS baseline.");
        throw new Error("Staging requires a retained, confirmed CMS baseline.");
      }
      // Git-triggered develop previews may be newer than the last Live CMS
      // publication. Only the exact recorded Pages deployment can anchor
      // rollback, and it must match both the immutable and public markers.
      stage = "baseline_verification";
      const baselineMarker = { jobId: recovery.id, sourceSha: recovery.source_sha,
        digest: manifestDigest(recovery.manifest) };
      previous = await provider.verifiedStagingBaseline(recovery, verify, baselineMarker);
    } else {
      stage = "previous_deployment";
      previous = await provider.previous();
    }
    stage = "temporary_directory";
    directory = await mkdtemp(path.join(tmpdir(), "twe-publication-worker-"));
    if (settings.environment === "staging") {
      stage = "archive_restore";
      recoveryDirectory = path.join(directory, "recovery");
      await archive.restore(recovery.id, recoveryDirectory);
    }
    stage = "prepare_artifact";
    const artifact = await prepare(job, media, directory, { approvedBaseline: true });
    const out = path.join(directory, "dist");
    stage = "website_build";
    await run("pnpm", ["--filter", "@faako/travel-with-ease-web", "run", "build"], publicBuildEnvironment({
      environment: settings.environment, siteOrigin: settings.origin, apiOrigin: settings.apiOrigin,
      turnstileSiteKey: settings.turnstileSiteKey, indexable: settings.environment === "production" && settings.indexable === true,
      sourceSha: job.source_sha, googleVerification: settings.googleVerification || "",
      snapshot: artifact.snapshot, publicDirectory: artifact.publicDirectory, out,
    }));
    stage = "archive_retain";
    if (archive) await archive.retain(job.id, out);
    stage = "mark_deploying";
    await publication.transition(job.id, job.build_token, "building", "deploying");
    deploymentStarted = true;
    stage = "pages_deployment";
    deployed = await provider.deploy(out, { ...job, startedAt: new Date().toISOString() });
    stage = "mark_verifying";
    await publication.transition(job.id, job.build_token, "deploying", "verifying");
    // Verify both the immutable deployment and the public custom domain.
    stage = "immutable_marker";
    await verify(deployed.origin, artifact.marker);
    stage = "current_origin_marker";
    await verify(settings.origin, artifact.marker);
    confirmationStarted = true;
    stage = "database_confirmation";
    await publication.confirm(job.id, job.build_token, deployed.id, manifestDigest(job.manifest));
    confirmed = true;
    return { id: job.id, status: "live", deploymentId: deployed.id };
  } catch {
    logger.error?.({ eventName: "publication.release_stage_failed", jobId: job.id,
      stage, deploymentStarted, confirmationStarted },
      "Publication failed at a specific pipeline stage; no raw provider errors were logged.");
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
