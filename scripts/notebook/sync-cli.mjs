/**
 * CLI for GitHub-verified merged PR -> curated Notion activity updates.
 * Default: GitHub-only dry run. No Notion token is used unless --write is explicit.
 */
import {execFileSync} from "node:child_process";
import {planMergedPullRequest, applyPlan, REPOSITORY} from "./sync-core.mjs";
import {NotionApi} from "./notion-adapter.mjs";

const GH = `https://api.github.com/repos/${REPOSITORY}`;
const SHA40 = /^[a-f0-9]{40}$/i;

function parseArgs(argv) {
  const hasPr = argv.includes("--pr");
  const hasCommit = argv.includes("--commit");
  if (hasPr === hasCommit) {
    throw new Error("Provide exactly one of --pr <number> or --commit <40-char-sha>");
  }
  const flag = hasPr ? "--pr" : "--commit";
  const idx = argv.indexOf(flag);
  const value = argv[idx + 1];
  if (hasPr && (!/^\d{1,8}$/.test(value || "") || +value < 1)) {
    throw new Error("Invalid PR number");
  }
  if (hasCommit && !SHA40.test(value || "")) throw new Error("Invalid commit SHA");
  if (argv.some((v, i) => i !== idx && i !== idx + 1 && v !== "--write")) {
    throw new Error("Unknown CLI option");
  }
  return {number: hasPr ? +value : null, commit: hasCommit ? value : null, write: argv.includes("--write")};
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

async function resolveCommit(sha, token) {
  const prs = await githubRequest(`/commits/${sha}/pulls?per_page=100`, token);
  if (!Array.isArray(prs)) throw new Error("Unexpected GitHub commit PR response");
  const merged = prs.filter(pr => pr.merged_at && pr.merge_commit_sha?.toLowerCase() === sha.toLowerCase()
    && ["develop", "main"].includes(pr.base?.ref));
  if (merged.length === 0) return null; // Direct commit, not a verified merged PR.
  if (merged.length !== 1 || prs.length >= 100) throw new Error("Ambiguous commit-to-PR mapping");
  return merged[0].number;
}

async function fetchPullRequest(number, token) {
  const pr = await githubRequest(`/pulls/${number}`, token);
  const files = [];
  for (let page = 1; page <= 6; page += 1) {
    const batch = await githubRequest(`/pulls/${number}/files?per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) throw new Error("GitHub changed-file response is invalid");
    files.push(...batch);
    if (files.length > 500) throw new Error("More than 500 changed files; manual review required");
    if (batch.length < 100) return {pr, files};
  }
  throw new Error("Changed-file pagination exceeded safe maximum");
}

function requireAncestor(sha, branch) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, `origin/${branch}`], {
      stdio: "ignore", timeout: 20000,
    });
  } catch {
    throw new Error("Merged commit is not reachable from checked-out target branch");
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const {number: requested, commit, write} = parseArgs(argv);
  if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY !== REPOSITORY) {
    throw new Error("Unexpected GitHub repository");
  }
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GitHub API token");
  if (write && env.FAAKO_NOTEBOOK_SYNC_ENABLED !== "true") {
    throw new Error("Notion writes disabled by FAAKO_NOTEBOOK_SYNC_ENABLED");
  }
  if (write && !env.FAAKO_NOTEBOOK_NOTION_TOKEN) throw new Error("Notion write token not configured");

  const number = requested || await resolveCommit(commit, token);
  if (!number) {
    const skipped = {mode: "skipped", reason: "Not a verified merged PR", notionWritesPerformed:false};
    process.stdout.write(JSON.stringify(skipped) + "\n");
    return skipped;
  }

  const {pr, files} = await fetchPullRequest(number, token);
  const plan = planMergedPullRequest(pr, files);
  if (commit && plan.commitSha !== commit.toLowerCase()) {
    throw new Error("Resolved PR merge commit did not match triggering commit");
  }
  requireAncestor(plan.commitSha, plan.branch);
  if (!write) {
    const result = {
      mode:"dry-run", prNumber:plan.prNumber, branch:plan.branch,
      commitSha:plan.commitSha, syncKey:plan.syncKey,
      affectedComponents:plan.affectedComponents,
      reviewRequired:plan.reviewRequired, reviewReasons:plan.reviewReasons,
      notionWritesPerformed:false,
    };
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return result;
  }

  const notion = new NotionApi(env.FAAKO_NOTEBOOK_NOTION_TOKEN);
  await notion.assertNotebookScope();
  const outcome = await applyPlan(plan, notion, {write:true});
  const summary = {
    mode:"write", prNumber:plan.prNumber, syncKey:plan.syncKey,
    journalAction:outcome.journal,
    notesUpdated:outcome.notesToAppend,
    notesAlreadyPresent:outcome.alreadyPresent,
    reviewRequired:plan.reviewRequired,
    claimedDeployment:false,
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
