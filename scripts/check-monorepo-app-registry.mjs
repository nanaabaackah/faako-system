import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getMonorepoApps,
  getMonorepoMonitoringSites,
} from "../packages/config/src/monorepoApps/appRegistry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appsDir = path.join(repoRoot, "apps");

const toAppDirName = (appPath = "") => {
  const normalized = String(appPath || "").replace(/\\/g, "/");
  if (!normalized.startsWith("apps/")) return "";
  return normalized.split("/")[1] || "";
};

const listAppDirectories = async () => {
  const entries = await readdir(appsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
};

const findDuplicates = (values = []) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort((a, b) => a.localeCompare(b));
};

const appDirs = await listAppDirectories();
const registryApps = getMonorepoApps();
const registryDirs = registryApps.map((app) => toAppDirName(app.path)).filter(Boolean);
const registryKeys = registryApps.map((app) => app.key).filter(Boolean);
const monitoredAppKeys = getMonorepoMonitoringSites({}).map((site) => site.appKey || site.id);

const registryDirSet = new Set(registryDirs);
const appDirSet = new Set(appDirs);
const monitoredAppKeySet = new Set(monitoredAppKeys);

const missingFromRegistry = appDirs.filter((dirName) => !registryDirSet.has(dirName));
const staleRegistryPaths = registryApps
  .filter((app) => app.workspaceRequired !== false)
  .map((app) => toAppDirName(app.path))
  .filter((dirName) => dirName && !appDirSet.has(dirName));
const deferredRegistryPaths = registryApps
  .filter((app) => app.workspaceRequired === false)
  .map((app) => toAppDirName(app.path))
  .filter((dirName) => dirName && !appDirSet.has(dirName));
const duplicateKeys = findDuplicates(registryKeys);
const duplicatePaths = findDuplicates(registryDirs);
const enabledMonitoringMissing = registryApps
  .filter((app) => app.monitoringEnabled && !monitoredAppKeySet.has(app.key))
  .map((app) => app.key)
  .sort((a, b) => a.localeCompare(b));

const warnings = [
  missingFromRegistry.length
    ? `Missing registry entries for app directories: ${missingFromRegistry.join(", ")}`
    : "",
  staleRegistryPaths.length
    ? `Registry paths without app directories: ${staleRegistryPaths.join(", ")}`
    : "",
  duplicateKeys.length ? `Duplicate registry keys: ${duplicateKeys.join(", ")}` : "",
  duplicatePaths.length ? `Duplicate registry paths: ${duplicatePaths.join(", ")}` : "",
  enabledMonitoringMissing.length
    ? `Monitoring-enabled registry apps missing from monitoring output: ${enabledMonitoringMissing.join(", ")}`
    : "",
].filter(Boolean);

console.log(
  JSON.stringify(
    {
      appDirectories: appDirs,
      registryKeys,
      monitoredAppKeys,
      registeredAppCount: registryApps.length,
      monitoredAppCount: monitoredAppKeys.length,
      deferredRegistryPaths,
      status: warnings.length ? "warning" : "ok",
    },
    null,
    2
  )
);

if (deferredRegistryPaths.length) {
  console.log(
    `Registry check note: Deferred registry paths without app directories: ${deferredRegistryPaths.join(", ")}`
  );
}

if (warnings.length) {
  for (const warning of warnings) {
    console.warn(`Registry check warning: ${warning}`);
  }
  process.exitCode = 1;
}
