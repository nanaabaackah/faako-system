import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findWorkspaceRoot, getAffectedApps } from "../workspace-graph.mjs";

const rootDir = findWorkspaceRoot(path.dirname(fileURLToPath(import.meta.url)));
const allAppNames = () => getAffectedApps({ rootDir, files: ["pnpm-workspace.yaml"] }).apps.map((app) => app.name);

export const classifyImpact = ({ changedFiles = [], affectedAppNames = [], isGlobalChange = false } = {}) => {
  const files = changedFiles.map((name) => String(name).replaceAll("\\", "/"));
  const globalWorkflow = files.some((file) =>
    [".github/workflows/monorepo-ci.yml", ".github/workflows/travel-with-ease-foundation.yml"].includes(file)
  );
  // Root scripts may be invoked at build time from any workspace. Fail closed on
  // these changes until script-to-app dependencies are explicitly registered.
  const globalScript = files.some((file) => file.startsWith("scripts/") || file === "nixpacks.toml");
  const global = isGlobalChange || globalWorkflow || globalScript;
  const all = global ? allAppNames() : affectedAppNames;
  const affected = new Set(all);
  const has = (name) => affected.has(name);
  const javascript = global || files.some((file) =>
    file.startsWith("apps/") || file.startsWith("packages/") ||
    ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json", "workspace-links.json"].includes(file)
  );
  // REEBS Water browser tests cover its interactions with the portal/API. These
  // tests run on portal changes, but Water's Cloudflare deploy is independent.
  return {
    javascript,
    python: files.some((file) =>
      file.startsWith("services/reebs-analytics/") ||
      [".github/workflows/monorepo-ci.yml", "pnpm-workspace.yaml"].includes(file)
    ),
    faako_public: has("@faako/faako-website"),
    reebs_public: has("@faako/reebs-website"),
    dev_erp: has("@faako/dev-erp"),
    reebs_water: has("@faako/reebs-water") || has("@faako/reebs-portal"),
    twe: ["@faako/travel-with-ease-web", "@faako/travel-with-ease-portal", "@faako/travel-with-ease-api"].some(has),
    affected_apps: [...affected].sort(),
    global,
  };
};

const parseArgs = (args) => {
  const options = { files: [] };
  for (let i = 0; i < args.length; i++) {
    if (["--base", "--head", "--output"].includes(args[i])) {
      options[args[i].slice(2)] = args[++i];
    } else if (args[i] === "--files") {
      options.files.push(...args.slice(i + 1));
      break;
    } else {
      throw new Error(`Unexpected argument: ${args[i]}`);
    }
  }
  return options;
};

export const run = (args = process.argv.slice(2)) => {
  const argsParsed = parseArgs(args);
  const result = getAffectedApps({
    rootDir,
    baseRef: argsParsed.base,
    headRef: argsParsed.head || "HEAD",
    files: argsParsed.files,
  });
  if (result.reason) throw new Error(result.reason);
  const impact = classifyImpact({
    changedFiles: result.changedFiles,
    affectedAppNames: result.apps.map((app) => app.name),
    isGlobalChange: result.isGlobalChange,
  });
  // The list is informative only. Deployment is separately controlled per
  // Cloudflare Pages project; no secrets or provider actions occur in CI.
  const output = {
    ...impact,
    base: result.baseRef,
    head: result.headRef,
    changed_file_count: result.changedFiles.length,
  };
  if (argsParsed.output) {
    const rows = Object.entries(output).map(([key, value]) =>
      `${key}=${Array.isArray(value) ? JSON.stringify(value) : String(value)}`
    );
    fs.appendFileSync(argsParsed.output, rows.join("\n") + "\n", "utf8");
  }
  return output;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(run(), null, 2));
  } catch (error) {
    console.error(`Affected-app detection failed closed: ${error.message}`);
    process.exitCode = 1;
  }
}
