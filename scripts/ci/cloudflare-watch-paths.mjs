import path from "node:path";
import { fileURLToPath } from "node:url";
import { findWorkspaceRoot, getWorkspaceGraph } from "../workspace-graph.mjs";

const rootDir = findWorkspaceRoot(path.dirname(fileURLToPath(import.meta.url)));
const sharedInputs = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "workspace-links.json",
  // Shared Vite build helpers are part of Turbo global build inputs;
  // CI-only scripts must not trigger Cloudflare Pages deployments.
  "scripts/vite/*",
];
const sort = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export const getWatchPaths = (graph, appName) => {
  const app = graph.projectsByName.get(appName);
  if (!app || app.kind !== "app") throw new Error(`Unknown application workspace: ${appName}`);
  const visited = new Set();
  const queue = [appName];
  while (queue.length) {
    const current = queue.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    const project = graph.projectsByName.get(current);
    if (!project) throw new Error(`Unresolved app dependency: ${current}`);
    queue.push(...project.dependencies);
  }
  return {
    appName,
    // Native Cloudflare watch paths use '*' across nested directories.
    include: sort([...visited].map((name) => `${graph.projectsByName.get(name).dir}/*`).concat(sharedInputs)),
    exclude: [],
    notes: [
      "Apply to this specific Git-connected Cloudflare Pages project under Settings > Build > Build watch paths.",
      "This configuration does not control Railway/API deployments or CMS-triggered publish hooks.",
      "A shared build input intentionally triggers every project because its effect may be global.",
    ],
  };
};

export const run = (args = process.argv.slice(2)) => {
  const graph = getWorkspaceGraph(rootDir);
  const only = args.indexOf("--app");
  const appName = only >= 0 ? args[only + 1] : null;
  if (only >= 0 && !appName) throw new Error("--app requires the workspace package name");
  const apps = appName ? [appName] : graph.apps.map((app) => app.name);
  return apps.map((name) => getWatchPaths(graph, name));
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(run(), null, 2)); }
  catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
