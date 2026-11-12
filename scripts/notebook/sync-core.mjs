/**
 * Deterministic, non-AI Faako Notebook sync planner and idempotent applier.
 * Only GitHub's merged-PR metadata and changed filenames are accepted.
 */
import { classifyChangedPaths } from "./impact.mjs";

export const REPOSITORY = "nanaabaackah/faako-system";
export const REGISTRY_DS = "1128a226-113d-4be0-80d7-df8df99f374f";
export const JOURNAL_DS = "88e12d00-eb97-4d0d-a745-1f5b6faf94fc";
const SHA40 = /^[a-f0-9]{40}$/i;
const MAX_CHANGED_PATHS = 500;

export function planMergedPullRequest(pr, files) {
  if (!pr || !Array.isArray(files) || files.length > MAX_CHANGED_PATHS) {
    throw new Error("Missing PR, invalid filenames, or oversized PR; manual review required");
  }
  const number = pr.number;
  const base = pr.base?.ref;
  const sha = pr.merge_commit_sha;
  if (!Number.isSafeInteger(number) || number <= 0 ||
      pr.state !== "closed" || pr.merged !== true || !pr.merged_at ||
      !["develop", "main"].includes(base) || !SHA40.test(sha || "")) {
    throw new Error("Only verified merged PRs targeting develop or main are eligible");
  }
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(pr.merged_at) ||
      !Number.isFinite(Date.parse(pr.merged_at))) {
    throw new Error("PR merged_at is missing or invalid");
  }
  // Renames affect both old and new components; content and PR bodies are not read.
  const paths = [];
  for (const file of files) {
    if (!file || typeof file.filename !== "string") throw new Error("Invalid PR filename");
    paths.push(file.filename);
    if (file.status === "renamed" && typeof file.previous_filename === "string") {
      paths.push(file.previous_filename);
    }
  }
  const impact = classifyChangedPaths(paths);
  const syncKey = `github:pr:${number}:merged:${base}`;
  const githubUrl = `https://github.com/${REPOSITORY}/pull/${number}`;
  const commitUrl = `https://github.com/${REPOSITORY}/commit/${sha}`;
  return {
    schemaVersion: 1,
    event: "github.merged_pull_request",
    repo: REPOSITORY,
    prNumber: number,
    branch: base,
    mergedAt: new Date(pr.merged_at).toISOString(),
    commitSha: sha.toLowerCase(),
    githubUrl,
    commitUrl,
    syncKey,
    changedFilesCount: impact.changedFiles.length,
    changedFiles: impact.changedFiles,
    affectedComponents: impact.affectedComponents,
    reviewRequired: true,
    reviewReasons: impact.reviewReasons,
    possibleDependentAppsNotVerified: impact.requiresManualReview,
    claimedDeployment: false,
    claimedCiPass: false,
    label: "Code change observed — technical review pending",
  };
}

export function journalProperties(plan) {
  return {
    "Event": {title: [{type: "text", text: {content: `PR #${plan.prNumber} merged into ${plan.branch}`}}]},
    "Type": {select: {name: "Merged PR"}},
    "Outcome": {select: {name: "Merged"}},
    "Branch": {select: {name: plan.branch}},
    "Environment": {select: {name: plan.branch === "develop" ? "Development" : "Not applicable"}},
    "Occurred": {date: {start: plan.mergedAt}},
    "Component": {rich_text: [{type: "text", text: {content: plan.affectedComponents.join(", ").slice(0, 1900)}}]},
    "Commit SHA": {rich_text: [{type: "text", text: {content: plan.commitSha}}]},
    "Evidence": {url: plan.githubUrl},
    "Sync Key": {rich_text: [{type: "text", text: {content: plan.syncKey}}]},
  };
}

export function textBlock(type, text, link) {
  if (typeof text !== "string" || text.length > 1900) throw new Error("Unsafe block length");
  return {
    object: "block", type,
    [type]: {rich_text: [{
      type: "text",
      text: link ? {content: text, link: {url: link}} : {content: text},
    }]},
  };
}

export function journalBlocks(plan) {
  return [
    textBlock("paragraph", "This entry records a GitHub-verified merge. It does not certify CI, deployment, production acceptance or a completed feature."),
    textBlock("paragraph", `Target: ${plan.branch} | SHA: ${plan.commitSha} | Files: ${plan.changedFilesCount} | Affected: ${plan.affectedComponents.join(", ").slice(0, 1000)}`),
    textBlock("paragraph", "GitHub PR evidence", plan.githubUrl),
    textBlock("paragraph", "Exact commit", plan.commitUrl),
    textBlock("paragraph", `Faako sync key: ${plan.syncKey}`),
  ];
}

export function pageMarker(plan) {
  return `faako-notebook-sync:${plan.syncKey}`;
}

export function changeNoteBlocks(plan) {
  return [
    textBlock("heading_3", "GitHub change observed — pending technical review"),
    textBlock("paragraph", pageMarker(plan)),
    textBlock("paragraph", `Merged PR #${plan.prNumber} into ${plan.branch} at ${plan.mergedAt}. Commit: ${plan.commitSha}. This event updates the activity history only; existing technical reference and last-reviewed status remain unchanged.`),
    textBlock("paragraph", "Source PR", plan.githubUrl),
  ];
}

/**
 * Notion adapter contract is injected so tests cannot reach live services.
 * First validate all registry mappings, then upsert journal and append notes.
 * A partial error may be retried: journal checks Sync Key, page notes check marker.
 * Pages are never deleted or replaced.
 */
export async function applyPlan(plan, adapter, {write = false} = {}) {
  const uniquePaths = plan.affectedComponents.filter(path => path !== "faako-system");
  const targets = [];
  for (const path of uniquePaths) {
    const matches = await adapter.findRegistryByPath(path);
    if (matches.length !== 1) throw new Error(`Registry mismatch for ${path}: ${matches.length} records`);
    targets.push({path, pageId: matches[0].id});
  }
  const prior = await adapter.findJournalBySyncKey(plan.syncKey);
  if (prior.length > 1) throw new Error("Duplicate journal Sync Key; manual recovery required");
  const missingNotes = [];
  for (const target of targets) {
    if (!(await adapter.hasPageMarker(target.pageId, pageMarker(plan)))) {
      missingNotes.push(target);
    }
  }
  const summary = {
    syncKey: plan.syncKey,
    journal: prior.length ? "exists" : "create",
    notesToAppend: missingNotes.map(x => x.path),
    alreadyPresent: targets.filter(x => !missingNotes.includes(x)).map(x => x.path),
    write,
  };
  if (!write) return summary;
  if (!prior.length) await adapter.createJournal(journalProperties(plan), journalBlocks(plan));
  for (const target of missingNotes) {
    // If a prior append timed out but persisted, recheck before retrying.
    if (!(await adapter.hasPageMarker(target.pageId, pageMarker(plan)))) {
      await adapter.appendChangeNote(target.pageId, changeNoteBlocks(plan));
    }
  }
  return {...summary, result: "applied"};
}
