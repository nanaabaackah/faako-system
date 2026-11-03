import path from "node:path";
import { fileURLToPath } from "node:url";
import { runReviewedCommand } from "./build.js";

export function readPagesConfiguration(env = process.env) {
  const environment = env.APP_ENV;
  if (!["staging", "production"].includes(environment) || env.TWE_PUBLICATION_WORKER_ENABLED !== "true") throw new Error("Hosted publication worker is not enabled.");
  const expectedOrigin = environment === "production" ? "https://travelwitheasegh.com" : "https://staging.travelwitheasegh.com";
  const branch = environment === "production" ? "main" : "develop";
  if (env.TWE_PUBLIC_SITE_ORIGIN !== expectedOrigin || env.TWE_PAGES_BRANCH !== branch ||
    !/^[a-f0-9]{32}$/.test(env.TWE_PAGES_ACCOUNT_ID || "") || !/^[a-z0-9][a-z0-9-]{0,57}$/.test(env.TWE_PAGES_PROJECT || "") || !env.TWE_PAGES_API_TOKEN?.trim() || !/^[a-f0-9]{40}$/.test(env.TWE_RELEASE_SHA || "")) throw new Error("Environment-scoped Pages configuration is incomplete.");
  return { environment, origin: expectedOrigin, branch, accountId: env.TWE_PAGES_ACCOUNT_ID, project: env.TWE_PAGES_PROJECT, token: env.TWE_PAGES_API_TOKEN, sourceSha: env.TWE_RELEASE_SHA };
}

export class PagesProvider {
  constructor(settings, { fetcher = fetch, run = runReviewedCommand } = {}) { Object.assign(this, { settings, fetcher, run }); }
  async request(suffix = "", method = "GET") {
    const { accountId, project, token } = this.settings;
    const response = await this.fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}${suffix}`, {
      method, headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("Pages provider request failed.");
    const payload = await response.json();
    if (!payload.success || !payload.result) throw new Error("Pages provider rejected the operation.");
    return payload.result;
  }
  async previous() {
    const project = await this.request();
    // Each environment needs its own Pages project/custom domain. Rollback is
    // authoritative only for the project's production branch, not a preview alias.
    if (project.production_branch !== "main") throw new Error("Pages project production branch must remain main.");
    let previous = project.canonical_deployment || project.production_deployment;
    if (this.settings.environment === "staging") {
      const deployments = await this.request("/deployments?per_page=100");
      previous = deployments.find(item => item.environment === "preview" && item.deployment_trigger?.metadata?.branch === "develop" && item.latest_stage?.status === "success");
    }
    if (!previous?.id || !/^[a-f0-9-]{36}$/.test(previous.id)) throw new Error("A known-good Pages deployment is required before automated publication.");
    return previous;
  }
  async deploy(directory, job) {
    const wrangler = fileURLToPath(new URL("bin/wrangler.js", import.meta.resolve("wrangler/package.json")));
    await this.run(process.execPath, [wrangler, "pages", "deploy", path.resolve(directory),
      "--project-name", this.settings.project, "--branch", this.settings.branch,
      "--commit-hash", job.source_sha, "--commit-dirty=false"], {
      PATH: process.env.PATH, ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
      CLOUDFLARE_API_TOKEN: this.settings.token, CLOUDFLARE_ACCOUNT_ID: this.settings.accountId,
      CI: "true", WRANGLER_SEND_METRICS: "false",
    }, { timeout: 180_000 });
    const deployments = await this.request("/deployments?per_page=10");
    const candidates = deployments.filter(item => item.deployment_trigger?.metadata?.commit_hash === job.source_sha && item.deployment_trigger?.metadata?.branch === this.settings.branch && Date.parse(item.created_on) >= Date.parse(job.startedAt));
    if (candidates.length !== 1 || candidates[0].latest_stage?.status !== "success") throw new Error("The exact successful deployment could not be identified.");
    const deployment = candidates[0];
    const origin = new URL(deployment.url);
    if (origin.protocol !== "https:" || origin.origin !== deployment.url || !origin.hostname.endsWith(`.${this.settings.project}.pages.dev`) || !/^[a-f0-9-]{36}$/.test(deployment.id)) throw new Error("Unexpected deployment identity.");
    return { id: deployment.id, origin: origin.origin };
  }
  async rollback(previous) {
    if (!/^[a-f0-9-]{36}$/.test(previous?.id || "")) throw new Error("Invalid recovery deployment.");
    if (this.settings.environment === "staging") throw new Error("Preview branch recovery requires the retained exact artifact; production rollback must not be used for staging.");
    await this.request(`/deployments/${previous.id}/rollback`, "POST");
    const project = await this.request();
    if ((project.canonical_deployment || project.production_deployment)?.id !== previous.id) throw new Error("Recovery deployment is not confirmed.");
  }
}
