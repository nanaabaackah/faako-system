import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPaths = ["package.json"];

for (const workspaceDir of ["apps", "packages"]) {
  const absoluteWorkspaceDir = path.join(repoRoot, workspaceDir);
  for (const entry of readdirSync(absoluteWorkspaceDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(workspaceDir, entry.name, "package.json");
    if (existsSync(path.join(repoRoot, manifestPath))) manifestPaths.push(manifestPath);
  }
}

const failures = [];
const packageNames = new Map();

for (const relativePath of manifestPaths.sort()) {
  const absolutePath = path.join(repoRoot, relativePath);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    continue;
  }

  const packageName = String(manifest?.name || "").trim();
  if (!packageName) {
    failures.push(`${relativePath}: missing package name`);
    continue;
  }
  if (packageNames.has(packageName)) {
    failures.push(`${relativePath}: duplicate package name ${packageName} (also in ${packageNames.get(packageName)})`);
    continue;
  }
  packageNames.set(packageName, relativePath);
}

if (failures.length) {
  console.error("Workspace package manifest validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Workspace package manifest validation passed. Checked ${manifestPaths.length} package.json files.`);
