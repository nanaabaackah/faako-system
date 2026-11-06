/**
 * CLI for approved GitHub merged PR -> curated Notion activity update.
 * Default mode: GitHub-only dry run; NO Notion token required.
 */
import {execFileSync} from "node:child_process";
import {planMergedPullRequest, applyPlan, REPOSITORY} from "./sync-core.mjs";
import {NotionApi} from "./notion-adapter.mjs";

const GH = `https://api.github.com/repos/${REPOSITORY}`;
const OWNER = REPOSITORY.split("/")[0];
const REPO = REPOSITORY.split("/")[1];

function argsFrom(argv) {
  const index = argv.indexOf("--pr");
  const number = argv[index + 1];
  if (index === -1 || !/^\d{1,8}$/.test(number || "") ||
      !Number.isSafeInteger(Number(number)) || Number(number) < 1) {
    throw new Error("Usage: node scripts/notebook/sync-cli.mjs --pr <number> [--write]");
  }
  const unknown = argv.filter((v, i) => i !== index && i !== index + 1 && v !== "--write");
  if (unknown.length > 0) throw new Error("Unknown CLI option");
  return {number: Number(number), write: argv.includes("--write")};
}

async function githubRequest(route, token) {
  const response = await fetch(GH + route, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "FaakoNotebookSync/1.0",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`GitHub request failed (HTTP ${response.status})`);
  return response.json();
}

async function fetchPullRequest(number, token) {
  const pr = await githubRequest(`/pulls/${number}`, token);
  const files = [];
  for (let page = 1; page <= 6; page += 1) {
    const batch = await githubRequest(`/pulls/${number}/files?per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) throw new Error("GitHub changed-file response is not an array");
    files.push(...batch);
    if (files.length > 500) throw new Error("More than 500 changed files; manual review required");
    if (batch.length < 100) return {pr, files};
  }
  throw new Error("Changed file pagination exceeded safe maximum");
}

function requireAncestor(sha, branch) {
  // The full commit history and target branch must be present in checkout.
  // Verified merged PRs that are not reachable from that branch must not publish.
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, `origin/${branch}`], {
      stdio: "ignore", timeout: 20000,
    });
  } catch {
    throw new Error("Merged commit is not reachable from checked-out target branch");
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const {number, write} = argsFrom(argv);
  if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY !== `${OWNER}/${REPO}`) {
    throw new Error("Unexpected GitHub repository");
  }
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GitHub token (read-only API access)");
  if (write && env.FAAKO_NOTEBOOK_SYNC_ENABLED !== "true") {
    throw new Error("Notion writes disabled by FAAKO_NOTEBOOK_SYNC_ENABLED");
  }
  if (write && !env.FAAKO_NOTEBOOK_NOTION_TOKEN) {
    throw new Error("Notion write token not configured");
  }

  const {pr, files} = await fetchPullRequest(number, token);
  const plan = planMergedPullRequest(pr, files);
  requireAncestor(plan.commitSha, plan.branch);

  // Dry-run uses GitHub ONLY: no Notion token/connection and no writes.
  if (!write) {
    const summary = {
      mode: "dry-run",
      prNumber: plan.prNumber,
      branch: plan.branch,
      commitSha: plan.commitSha,
      affectedComponents: plan.affectedComponents,
      reviewRequired: plan.reviewRequired,
      reviewReasons: plan.reviewReasons,
      syncKey: plan.syncKey,
      notionWritesPerformed: false,
    };
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
    return summary;
  }

  const notion = new NotionApi(env.FAAKO_NOTEBOOK_NOTION_TOKEN);
  await notion.assertNotebookScope();
  const result = await applyPlan(plan, notion, {write: true});
  // Do not log source bodies, personal records, tokens or Notion API responses.
  const summary = {
    mode: "write",
    prNumber: plan.prNumber,
    syncKey: plan.syncKey,
    journalAction: result.journal,
    affectedComponents: plan.affectedComponents,
    notesUpdated: result.notesToAppend,
    notesAlreadyPresent: result.alreadyPresent,
    reviewRequired: plan.reviewRequired,
    claimedDeployment: false,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  return summary;
}

if (process.argv[1]?.endsWith("sync-cli.mjs")) {
  main().catch(error => {
    console.error(`Faako Notebook sync stopped safely: ${error.message}`);
    process.exitCode = 1;
  });
}
