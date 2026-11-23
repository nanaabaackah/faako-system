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
  // A dedicated staging Pages project serves 'develop' as its production
  // branch; the legacy shared project still serves it as a preview.
  // Keep both modes until a separately verified migration is completed.
  expectedProductionBranch() {
    return this.settings.environment === "staging" &&
      this.settings.project === "twe-concierge-staging" ? "develop" : "main";
  }
  expectedDeploymentEnvironment() {
    return this.settings.environment === "production" ||
      this.expectedProductionBranch() === "develop" ? "production" : "preview";
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
    if (this.settings.environment === "staging" && this.expectedDeploymentEnvironment() === "preview") {
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
  async deploy(directory, job) {
    const project = await this.request();
    this.assertProject(project);
    const wrangler = fileURLToPath(new URL("bin/wrangler.js", import.meta.resolve("wrangler/package.json")));
    await this.run(process.execPath, [wrangler, "pages", "deploy", path.resolve(directory),
      "--project-name", this.settings.project, "--branch", this.settings.branch,
      "--commit-hash", job.source_sha, "--commit-dirty=false"], {
      PATH: process.env.PATH, ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
      CLOUDFLARE_API_TOKEN: this.settings.token, CLOUDFLARE_ACCOUNT_ID: this.settings.accountId,
      CI: "true", WRANGLER_SEND_METRICS: "false",
    }, { timeout: 180_000 });
    // Wrangler can return before the Pages deployment reaches its terminal
    // stage. Poll read-only provider status instead of treating that normal
    // transition as an uncertain upload or issuing another deployment.
    for (let attempt = 0; attempt < 8; attempt++) {
      const deployments = await this.request("/deployments?per_page=10");
      if (!Array.isArray(deployments)) throw new Error("Invalid Pages deployment list.");
      const candidates = deployments.filter(item => item.deployment_trigger?.metadata?.commit_hash === job.source_sha &&
        item.deployment_trigger?.metadata?.branch === this.settings.branch &&
        item.environment === this.expectedDeploymentEnvironment() &&
        Date.parse(item.created_on) >= Date.parse(job.startedAt));
      if (candidates.length === 1 && candidates[0].latest_stage?.status === "success") {
        const deployment = candidates[0];
        const origin = deploymentOriginForProject(deployment, project, this.settings.project);
        if (!/^[a-f0-9-]{36}$/i.test(deployment.id)) throw new Error("Unexpected deployment identity.");
        return { id: deployment.id, origin };
      }
      if (candidates.some(item => ["failure", "canceled"].includes(item.latest_stage?.status)))
        throw new Error("Pages deployment did not succeed.");
      if (attempt < 7) await this.wait(3_000);
    }
    throw new Error("The exact successful deployment could not be identified.");
  }
  // Read-only search for a successfully deployed, environment-scoped artifact.
  // The caller must additionally verify its exact publication marker on both
  // the immutable Pages URL and the custom origin before acknowledging it.
  async findPublicationDeployment(job, verify, marker, logger = {}) {
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
    const report = reason => logger.info?.({
      eventName: "publication.reconciliation_scan", reason,
      pagesScanned, rowsSeen, distinctDeployments: seen.size,
      repeatedPages, sourceMatches, olderThanJob, candidates, verified: matches.length,
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
        if (source === job.source_sha) sourceMatches++;
        if (deployment.latest_stage?.status !== "success") {
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
      throw error;
    }
    return matches[0];
  }
  async rollback(previous) {
    if (!/^[a-f0-9-]{36}$/.test(previous?.id || "")) throw new Error("Invalid recovery deployment.");
    if (this.settings.environment === "staging") throw new Error("Preview branch recovery requires the retained exact artifact; production rollback must not be used for staging.");
    await this.request(`/deployments/${previous.id}/rollback`, "POST");
    const project = await this.request();
    if ((project.canonical_deployment || project.production_deployment)?.id !== previous.id) throw new Error("Recovery deployment is not confirmed.");
  }
}
