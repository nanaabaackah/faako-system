import path from "node:path";
import { fileURLToPath } from "node:url";
import { runReviewedCommand } from "./build.js";
import { requireRailwaySourceSha } from "./source-identity.js";

export function readPagesConfiguration(env = process.env) {
  const environment = env.APP_ENV;
  if (!["staging", "production"].includes(environment) || env.TWE_PUBLICATION_WORKER_ENABLED !== "true") throw new Error("Hosted publication worker is not enabled.");
  const expectedOrigin = environment === "production" ? "https://travelwitheasegh.com" : "https://staging.travelwitheasegh.com";
  const branch = environment === "production" ? "main" : "develop";
  if (env.TWE_PUBLIC_SITE_ORIGIN !== expectedOrigin || env.TWE_PAGES_BRANCH !== branch ||
    !/^[a-f0-9]{32}$/.test(env.TWE_PAGES_ACCOUNT_ID || "") || !/^[a-z0-9][a-z0-9-]{0,57}$/.test(env.TWE_PAGES_PROJECT || "") || !env.TWE_PAGES_API_TOKEN?.trim()) throw new Error("Environment-scoped Pages configuration is incomplete.");
  return { environment, origin: expectedOrigin, branch, accountId: env.TWE_PAGES_ACCOUNT_ID, project: env.TWE_PAGES_PROJECT, token: env.TWE_PAGES_API_TOKEN, sourceSha: requireRailwaySourceSha(env) };
}

export function deploymentOriginForProject(deployment, project, expectedProject) {
  if (project?.name !== expectedProject ||
    !/^[a-z0-9][a-z0-9-]{0,57}\.pages\.dev$/.test(project?.subdomain || ""))
    throw new Error("Unexpected Pages project identity.");
  const origin = new URL(deployment?.url);
  if (origin.protocol !== "https:" || origin.origin !== deployment.url ||
    !origin.hostname.endsWith(`.${project.subdomain}`))
    throw new Error("Unexpected deployment identity.");
  return origin.origin;
}

export class PagesProvider {
  // Reuse the existing Pages project: main is production, develop is staging preview.
  expectedProductionBranch() { return "main"; }
  expectedDeploymentEnvironment() {
    return this.settings.environment === "production" ? "production" : "preview";
  }
  assertProject(project) {
    if (project?.name !== this.settings.project ||
      project?.production_branch !== this.expectedProductionBranch())
      throw new Error("Unexpected Pages project identity or production branch.");
  }
  constructor(settings, { fetcher = fetch, run = runReviewedCommand, wait = delay => new Promise(resolve => setTimeout(resolve, delay)) } = {}) {
    Object.assign(this, { settings, fetcher, run, wait });
  }
  async request(suffix = "", method = "GET") {
    const { accountId, project, token } = this.settings;
    const attempts = method === "GET" ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await this.fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}${suffix}`, {
          method, headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) {
          const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
          if (retryable && attempt + 1 < attempts) {
            await response.body?.cancel();
            await this.wait(250 * (attempt + 1));
            continue;
          }
          throw new Error("Pages provider request failed.");
        }
        const payload = await response.json();
        if (!payload.success || !payload.result) throw new Error("Pages provider rejected the operation.");
        return payload.result;
      } catch (error) {
        if (method !== "GET" || attempt + 1 >= attempts || error?.message === "Pages provider request failed." || error?.message === "Pages provider rejected the operation.") throw error;
        await this.wait(250 * (attempt + 1));
      }
    }
    throw new Error("Pages provider request failed.");
  }
  async previous() {
    const project = await this.request();
    // Each environment needs its own Pages project/custom domain. Rollback is
    // authoritative only for the project's production branch, not a preview alias.
    this.assertProject(project);
    let previous = project.canonical_deployment || project.production_deployment;
    if (this.settings.environment === "staging") {
      // The Pages deployments endpoint currently rejects page sizes above 25.
      // The newest accepted develop preview is all recovery needs.
      const deployments = await this.request("/deployments?per_page=25");
      previous = deployments.find(item => item.environment === "preview" && item.deployment_trigger?.metadata?.branch === "develop" && item.latest_stage?.status === "success");
    }
    if (!previous?.id || !/^[a-f0-9-]{36}$/.test(previous.id)) throw new Error("A known-good Pages deployment is required before automated publication.");
    return previous;
  }
  // The staging rollback baseline is the last confirmed CMS publication,
  // not whichever Git-triggered develop preview is newest.
  // Verify the exact provider deployment and both publication markers before
  // trusting the retained archive for recovery.
  async verifiedStagingBaseline(recovery, verify, marker) {
    if (this.settings.environment !== "staging" ||
      !/^[a-f0-9-]{36}$/i.test(recovery?.deployment_id || "") ||
      !/^[a-f0-9]{40}$/.test(recovery?.source_sha || "") ||
      recovery?.id !== marker?.jobId ||
      recovery.source_sha !== marker?.sourceSha)
      throw new Error("Invalid staging publication baseline.");
    const project = await this.request();
    this.assertProject(project);
    const deployment = await this.request(`/deployments/${recovery.deployment_id}`);
    if (deployment.id !== recovery.deployment_id ||
      deployment.latest_stage?.status !== "success" ||
      deployment.environment !== this.expectedDeploymentEnvironment() ||
      deployment.deployment_trigger?.metadata?.branch !== this.settings.branch ||
      deployment.deployment_trigger?.metadata?.commit_hash !== recovery.source_sha)
      throw new Error("The recorded staging publication is not a verified Pages deployment.");
    const origin = deploymentOriginForProject(deployment, project, this.settings.project);
    await verify(origin, marker);
    await verify(this.settings.origin, marker);
    return { id: deployment.id, origin };
  }
  // A prior one-shot replay has an exact recorded deployment ID. Recover
  // directly from that immutable artifact instead of scanning and treating two
  // identically marked uploads as ambiguous.
  async verifyRecordedReplay(job, verify, marker) {
    const id = job?.recovery_deployment_id;
    if (this.settings.environment !== "staging" ||
      !/^[a-f0-9-]{36}$/i.test(id || "")) throw new Error("Invalid recorded staging replay.");
    const project = await this.request();
    this.assertProject(project);
    const deployment = await this.request(`/deployments/${id}`);
    if (deployment.id !== id ||
      deployment.latest_stage?.status !== "success" ||
      deployment.environment !== "preview" ||
      deployment.deployment_trigger?.metadata?.branch !== this.settings.branch ||
      deployment.deployment_trigger?.metadata?.commit_hash !== job.source_sha)
      throw new Error("Recorded staging replay is not a verified Pages deployment.");
    const origin = deploymentOriginForProject(deployment, project, this.settings.project);
    await verify(origin, marker);
    await verify(this.settings.origin, marker);
    return { id, origin };
  }
  async terminalStagingDeployment(job, logger = {}, { allowAbandoned = false, now = Date.now() } = {}) {
    const report = (reason, details = {}) => { logger.info?.({ eventName: "publication.terminal_evidence", jobId: job.id, reason, ...details }, "Checked terminal staging deployment evidence."); return null; };
    // Do not infer failure from a skipped Git build, missing evidence, an
    // incomplete scan, or a newer successful upload with the same SHA.
    if (this.settings.environment !== "staging" || job.status !== "deploying" || job.recovery_deployment_id || job.last_error === "staging_replay_claimed" || !/^[a-f0-9]{40}$/.test(job.source_sha || "")) return report("ineligible");
    const since = Date.parse(job.updated_at);
    if (!Number.isFinite(since)) return report("invalid_lease_time");
    const project = await this.request();
    this.assertProject(project);
    const candidates = [];
    const seen = new Set();
    let complete = false, competingUpload = false;
    // Only an explicitly requested staging code-release recovery may inspect
    // the larger bounded history. A truncated history is never absence proof.
    const maxPages = allowAbandoned ? 120 : 40;
    for (let page = 1; page <= maxPages; page++) {
      const rows = await this.request(`/deployments?per_page=25&page=${page}&env=preview`);
      if (!Array.isArray(rows) || rows.length > 25) return report("invalid_page");
      for (const row of rows) {
        if (!/^[a-f0-9-]{36}$/i.test(row.id || "") || seen.has(row.id)) return report("unstable_page", { pagesScanned: page });
        seen.add(row.id);
        const trigger = row.deployment_trigger;
        if (row.environment !== "preview" || trigger?.metadata?.branch !== this.settings.branch || trigger?.type === "github:push") continue;
        const rowTime = Date.parse(row.created_on);
        if (!Number.isFinite(rowTime)) return report("invalid_candidate_time");
        if (rowTime >= since - 5000 && !["success", "failure", "canceled", "skipped"].includes(row.latest_stage?.status) && row.is_skipped !== true) competingUpload = true;
        // Only an actual Direct Upload can supply terminal evidence.
        if (trigger?.metadata?.commit_hash !== job.source_sha) continue;
        const created = Date.parse(row.created_on);
        if (!Number.isFinite(created)) return report("invalid_candidate_time");
        if (created < since - 5000) continue;
        candidates.push(row);
      }
      if (rows.length < 25) { complete = true; break; }
    }
    if (complete && candidates.length === 0 && allowAbandoned && !competingUpload &&
        job.manifest?.triggerType === "code_release" && now - since >= 60 * 60 * 1000 &&
        /^[a-f0-9]{40}$/.test(this.settings.sourceSha || "") && job.source_sha !== this.settings.sourceSha) {
      // Superseded automatic code release, no matching provider record after
      // a complete preview scan, no pending competing direct upload, and a
      // full hour since upload initiation. The caller must prove the separate
      // last-live baseline and use the exact stale DB lease before closing.
      return { status: "upload_not_found" };
    }
    if (!complete || candidates.length !== 1) return report(!complete ? "incomplete_scan" : candidates.length === 0 ? "no_direct_candidate" : "ambiguous_candidates", { scanned: seen.size, candidates: candidates.length });
    const candidate = candidates[0];
    const exact = await this.request(`/deployments/${candidate.id}`);
    const trigger = exact.deployment_trigger;
    const status = exact.is_skipped === true && ["skipped", "failure", "canceled", "success"].includes(exact.latest_stage?.status) ? "skipped" : exact.latest_stage?.status;
    if (exact.id !== candidate.id || exact.environment !== "preview" || trigger?.type !== "ad_hoc" || trigger.metadata?.branch !== this.settings.branch || trigger.metadata?.commit_hash !== job.source_sha || Date.parse(exact.created_on) < since - 5000 || !Number.isFinite(Date.parse(exact.created_on)) || !["failure", "canceled", "skipped"].includes(status) || !Number.isFinite(Date.parse(exact.latest_stage?.ended_on))) return report("candidate_not_terminal", { deploymentId: candidate.id, providerStatus: ["active", "idle", "success", "failure", "canceled", "skipped"].includes(status) ? status : "unknown" });
    // A legacy deployment without a job tag can only be reconciled for an
    // automatic code release, with one unambiguous direct attempt. New
    // uploads have their own publication job identifier in provider metadata.
    const tag = trigger.metadata?.commit_message || "";
    if (tag.startsWith("TWE publication ") ? tag !== `TWE publication ${job.id}` : job.manifest?.triggerType !== "code_release") return report("job_identity_mismatch", { deploymentId: candidate.id });
    return { id: exact.id, status };
  }
  async deploy(directory, job) {
    const project = await this.request();
    this.assertProject(project);
    const wrangler = fileURLToPath(new URL("bin/wrangler.js", import.meta.resolve("wrangler/package.json")));
    await this.run(process.execPath, [wrangler, "pages", "deploy", path.resolve(directory),
      "--project-name", this.settings.project, "--branch", this.settings.branch,
      "--commit-hash", job.source_sha, "--commit-dirty=false",
      ...(job.id ? ["--commit-message", `TWE publication ${job.id}`] : [])], {
      PATH: process.env.PATH, ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
      CLOUDFLARE_API_TOKEN: this.settings.token, CLOUDFLARE_ACCOUNT_ID: this.settings.accountId,
      CI: "true", WRANGLER_SEND_METRICS: "false",
    }, { timeout: 300_000 });
    // Wrangler can return before the Pages deployment reaches its terminal
    // stage. Poll read-only provider status instead of treating that normal
    // transition as an uncertain upload or issuing another deployment.
    for (let attempt = 0; attempt < 8; attempt++) {
      const deployments = await this.request("/deployments?per_page=10");
      if (!Array.isArray(deployments)) throw new Error("Invalid Pages deployment list.");
      const candidates = deployments.filter(item => item.deployment_trigger?.metadata?.commit_hash === job.source_sha &&
        item.deployment_trigger?.metadata?.branch === this.settings.branch &&
        item.environment === this.expectedDeploymentEnvironment() &&
        (!job.id || (item.deployment_trigger?.type === "ad_hoc" && item.deployment_trigger.metadata?.commit_message === `TWE publication ${job.id}`)) &&
        Date.parse(item.created_on) >= Date.parse(job.startedAt));
      if (candidates.length === 1 && candidates[0].is_skipped !== true && candidates[0].latest_stage?.status === "success") {
        const deployment = candidates[0];
        const origin = deploymentOriginForProject(deployment, project, this.settings.project);
        if (!/^[a-f0-9-]{36}$/i.test(deployment.id)) throw new Error("Unexpected deployment identity.");
        return { id: deployment.id, origin };
      }
      if (candidates.some(item => ["failure", "canceled", "skipped"].includes(item.latest_stage?.status) || item.is_skipped === true))
        throw new Error("Pages deployment did not succeed.");
      if (attempt < 7) await this.wait(3_000);
    }
    throw new Error("The exact successful deployment could not be identified.");
  }
  // Read-only search for a successfully deployed, environment-scoped artifact.
  // The caller must additionally verify its exact publication marker on both
  // the immutable Pages URL and the custom origin before acknowledging it.
  async findPublicationDeployment(job, verify, marker, logger = {}, { allowCurrentMismatch = false } = {}) {
    const project = await this.request();
    this.assertProject(project);
    const earliest = Date.parse(job.created_at);
    if (!Number.isFinite(earliest)) throw new Error("Invalid publication creation date.");
    // Recovery is read-only. Cloudflare can report an artifact timestamp that
    // precedes its CMS job record (for example, when deployment evidence is
    // recorded later). Time ordering is not publication identity: require the
    // exact source SHA and markers on both the immutable and current origins.
    const pageSize = 25;
    const maxPages = 20;
    const matches = [];
    const seen = new Set();
    const reasons = {
      malformedId: 0, duplicate: 0, notSuccessful: 0, wrongBranch: 0,
      wrongSource: 0, shortSource: 0, wrongEnvironment: 0,
      invalidOrigin: 0, markerMismatch: 0,
    };
    let pagesScanned = 0, rowsSeen = 0, candidates = 0, hasMore = false;
    let sourceMatches = 0, repeatedPages = 0, olderThanJob = 0;
    const matchingSourceEvidence = [];
    const report = reason => logger.info?.({
      eventName: "publication.reconciliation_scan", reason,
      pagesScanned, rowsSeen, distinctDeployments: seen.size,
      repeatedPages, sourceMatches, olderThanJob, candidates, verified: matches.length, matchingSourceEvidence,
      rejectionReasons: reasons,
    }, "Pages publication candidates checked.");
    for (let page = 1; page <= maxPages; page++) {
      const deployments = await this.request(`/deployments?per_page=${pageSize}&page=${page}`);
      if (!Array.isArray(deployments)) throw new Error("Invalid Pages deployment list.");
      pagesScanned++;
      hasMore = deployments.length === pageSize;
      let newOnPage = 0;
      for (const deployment of deployments) {
        rowsSeen++;
        if (!/^[a-f0-9-]{36}$/i.test(deployment.id || "")) {
          reasons.malformedId++;
          continue;
        }
        if (seen.has(deployment.id)) {
          reasons.duplicate++;
          continue;
        }
        seen.add(deployment.id);
        newOnPage++;
        const source = deployment.deployment_trigger?.metadata?.commit_hash;
        if (source === job.source_sha) {
          sourceMatches++;
          if (matchingSourceEvidence.length < 12) {
            const type = deployment.deployment_trigger?.type;
            const status = deployment.latest_stage?.status;
            matchingSourceEvidence.push({
              id: deployment.id,
              trigger: ["github:push", "ad_hoc", "deploy_hook"].includes(type) ? type : "unknown",
              status: ["active", "idle", "success", "failure", "canceled", "skipped"].includes(status) ? status : "unknown",
              skipped: deployment.is_skipped === true,
              skipReason: ["commit_message", "preview_deployments_disabled", "production_deployments_disabled", "path_config", "branch_config", "pages_to_workers_conversion", "superseded_queued_build"].includes(deployment.skip_reason) ? deployment.skip_reason : null,
              correctBranch: deployment.deployment_trigger?.metadata?.branch === this.settings.branch,
              correctEnvironment: deployment.environment === this.expectedDeploymentEnvironment(),
            });
          }
        }
        if (deployment.is_skipped === true || deployment.latest_stage?.status !== "success") {
          reasons.notSuccessful++;
          continue;
        }
        if (deployment.deployment_trigger?.metadata?.branch !== this.settings.branch) {
          reasons.wrongBranch++;
          continue;
        }
        if (source !== job.source_sha) {
          if (typeof source === "string" && source.length >= 7 &&
              source.length < job.source_sha.length && job.source_sha.startsWith(source))
            reasons.shortSource++;
          else reasons.wrongSource++;
          continue;
        }
        if (deployment.environment !== this.expectedDeploymentEnvironment()) {
          reasons.wrongEnvironment++;
          continue;
        }
        // Keep temporal ordering as diagnostics, never as proof of identity.
        // A matching artifact must still pass both exact marker checks.
        if (!(Date.parse(deployment.created_on) >= earliest - 60_000))
          olderThanJob++;
        candidates++;
        try {
          const origin = deploymentOriginForProject(deployment, project, this.settings.project);
          await verify(origin, marker);
          matches.push({ id: deployment.id, origin });
        } catch {
          // The immutable marker and deployment URL must both be valid.
          // Keep diagnostics categorical; never log tokens or provider payloads.
          reasons.markerMismatch++;
        }
      }
      if (newOnPage === 0 && deployments.length > 0) repeatedPages++;
      if (matches.length > 1) {
        report("ambiguous");
        return null;
      }
      if (!hasMore || newOnPage === 0) break;
    }
    report(matches.length === 1 ? "candidate_found" : repeatedPages ? "repeated_page" : hasMore ? "scan_limit" : "no_match");
    if (matches.length !== 1) return null;
    try {
      await verify(this.settings.origin, marker);
    } catch (error) {
      logger.warn?.({ eventName: "publication.reconciliation_scan", reason: "current_origin_marker_mismatch",
        pagesScanned, candidates, verified: matches.length }, "The current site does not match the candidate publication.");
      if (allowCurrentMismatch && this.settings.environment === "staging")
        return { ...matches[0], currentMatches: false };
      throw error;
    }
    return { ...matches[0], currentMatches: true };
  }
  async rollback(previous) {
    if (!/^[a-f0-9-]{36}$/.test(previous?.id || "")) throw new Error("Invalid recovery deployment.");
    if (this.settings.environment === "staging") throw new Error("Preview branch recovery requires the retained exact artifact; production rollback must not be used for staging.");
    await this.request(`/deployments/${previous.id}/rollback`, "POST");
    const project = await this.request();
    if ((project.canonical_deployment || project.production_deployment)?.id !== previous.id) throw new Error("Recovery deployment is not confirmed.");
  }
}
