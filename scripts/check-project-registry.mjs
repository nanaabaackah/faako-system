import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getMonorepoApps,
  validatePortfolioProjectRegistry,
  PORTFOLIO_PROJECT_REGISTRY,
} from "../packages/config/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appsDir = path.join(repoRoot, "apps");

const listAppDirectories = async () => {
  const entries = await readdir(appsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

const toAppDirName = (appPath = "") => {
  const normalized = String(appPath || "").replace(/\\/g, "/");
  if (!normalized.startsWith("apps/")) return "";
  return normalized.split("/")[1] || "";
};

const appDirectories = await listAppDirectories();
const monorepoApps = getMonorepoApps();
const projectAppKeys = new Set(PORTFOLIO_PROJECT_REGISTRY.map((project) => project.appKey));
const projectAppPaths = new Set(
  PORTFOLIO_PROJECT_REGISTRY.map((project) => toAppDirName(project.appPath)).filter(Boolean)
);
const validationResults = validatePortfolioProjectRegistry();
const incompleteProjects = validationResults.filter((result) => !result.valid);

const publicCandidateApps = monorepoApps
  .filter((app) => ["client", "commerce", "marketing", "portfolio", "erp"].includes(app.category))
  .filter((app) => !["system-starter", "ui-workbench"].includes(app.key))
  .map((app) => ({
    key: app.key,
    path: toAppDirName(app.path),
    category: app.category,
    hasProjectMetadata: projectAppKeys.has(app.key),
  }));

const appDirsMissingProjectMetadata = appDirectories.filter((dirName) => !projectAppPaths.has(dirName));

const warnings = [
  incompleteProjects.length
    ? `Incomplete project metadata: ${incompleteProjects
        .map((result) => `${result.key || result.appKey}(${result.missing.join(",")})`)
        .join("; ")}`
    : "",
  appDirsMissingProjectMetadata.length
    ? `Apps without project metadata yet: ${appDirsMissingProjectMetadata.join(", ")}`
    : "",
].filter(Boolean);

console.log(
  JSON.stringify(
    {
      projectRegistryKeys: PORTFOLIO_PROJECT_REGISTRY.map((project) => project.key),
      appDirectories,
      publicCandidateApps,
      registeredProjectCount: PORTFOLIO_PROJECT_REGISTRY.length,
      incompleteProjectCount: incompleteProjects.length,
      status: warnings.length ? "warning" : "ok",
    },
    null,
    2
  )
);

for (const warning of warnings) {
  console.warn(`Project registry warning: ${warning}`);
}
