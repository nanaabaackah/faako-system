/**
 * Faako Notebook change-impact discovery.
 * Read-only. This module NEVER calls Notion or changes GitHub.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GLOBAL_FILES = new Set([
  "package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml",
  "turbo.json", "AGENTS.md", "workspace-links.json",
]);

const MULTI_APP_DOCS = {
  "travel-with-ease": [
    "apps/travel-with-ease-web", "apps/travel-with-ease-portal", "apps/travel-with-ease-api",
  ],
  reebs: ["apps/reebs-portal", "apps/reebs-website", "apps/reebs-water"],
};

function normalizeFile(file) {
  if (typeof file !== "string") throw new TypeError("Changed paths must be strings");
  const normalized = file.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0") ||
      normalized.split("/").some((segment) => segment === "..")) {
    throw new Error("Unsafe changed path");
  }
  return normalized;
}

export function classifyChangedPaths(changedPaths) {
  if (!Array.isArray(changedPaths)) throw new TypeError("Expected an array of paths");
  const files = [...new Set(changedPaths.map(normalizeFile))].sort();
  const components = new Set();
  const reasons = new Set();
  let needsReview = false;

  for (const file of files) {
    const parts = file.split("/");
    const isWorkspace = parts.length >= 3;
    if (parts[0] === "apps" && parts[1] === "ttngh" && parts[2] === "studio") {
      components.add("apps/ttngh/studio");
      continue;
    }
    if (parts[0] === "apps" && isWorkspace) {
      components.add(parts.slice(0, 2).join("/"));
      continue;
    }
    if (parts[0] === "packages" && isWorkspace) {
      components.add(parts.slice(0, 2).join("/"));
      needsReview = true;
      reasons.add("Shared package changes require dependent-app impact review.");
      continue;
    }
    if (parts[0] === "services" && isWorkspace) {
      components.add(parts.slice(0, 2).join("/"));
      continue;
    }
    if (parts[0] === "docs" && parts[1] === "apps" && parts.length >= 4) {
      const key = parts[2];
      if (MULTI_APP_DOCS[key]) {
        MULTI_APP_DOCS[key].forEach((component) => components.add(component));
      } else if (key === "reebs-portal") {
        components.add("apps/reebs-portal");
      } else if (key === "ttngh") {
        components.add("apps/ttngh");
        components.add("apps/ttngh/studio");
        components.add("services/ttngh-api");
      } else {
        needsReview = true;
        reasons.add("Documentation path has no mapped component; review manually.");
      }
      continue;
    }
    if (GLOBAL_FILES.has(file) || parts[0] === "scripts" ||
        parts[0] === ".github" || parts[0] === "docs") {
      components.add("faako-system");
      needsReview = true;
      reasons.add("Monorepo-wide infrastructure or documentation change.");
      continue;
    }
    components.add("faako-system");
    needsReview = true;
    reasons.add("Unmapped file must be classified manually.");
  }

  return {
    schemaVersion: 1,
    changedFiles: files,
    affectedComponents: [...components].sort(),
    requiresManualReview: needsReview,
    reviewReasons: [...reasons].sort(),
    status: "impact-analysis-only",
    verified: false,
    syncedToNotion: false,
  };
}

const isSha = (value) => /^[a-f\d]{40}$/i.test(value);
export function analyzeCommitRange(baseSha, headSha) {
  if (!isSha(baseSha) || !isSha(headSha)) {
    throw new Error("Both --base and --head must be full 40-character commit SHAs.");
  }
  const raw = execFileSync(
    "git", ["diff", "--name-only", "-z", baseSha, headSha, "--"], {
      cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
    },
  );
  const paths = raw.split("\0").filter(Boolean);
  return { baseSha, headSha, ...classifyChangedPaths(paths) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const base = args[args.indexOf("--base") + 1];
  const head = args[args.indexOf("--head") + 1];
  try {
    if (!args.includes("--base") || !args.includes("--head")) {
      throw new Error("Usage: node scripts/notebook/impact.mjs --base <sha> --head <sha>");
    }
    const result = analyzeCommitRange(base, head);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    console.error("Faako Notebook impact analysis failed:", error.message);
    process.exitCode = 1;
  }
}
