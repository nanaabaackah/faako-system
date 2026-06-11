import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { findWorkspaceRoot, getWorkspaceGraph } from "./workspace-graph.mjs";

const phase = String(process.argv[2] || "").trim();
const rootDir = findWorkspaceRoot();
const graph = getWorkspaceGraph(rootDir);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const requestedWorkspace =
  process.env.RAILWAY_WORKSPACE ||
  process.env.RAILWAY_PACKAGE ||
  process.env.FAAKO_RAILWAY_WORKSPACE ||
  "@faako/dev-erp";

const resolveWorkspace = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  return graph.apps.find((project) => (
    project.name === normalized ||
    project.dir === normalized ||
    project.dir === `apps/${normalized}` ||
    path.basename(project.dir) === normalized
  )) || null;
};

const project = resolveWorkspace(requestedWorkspace);

if (!["build", "start"].includes(phase)) {
  console.error("Usage: node ./scripts/railway-service.mjs <build|start>");
  process.exit(1);
}

if (!project) {
  console.error(`Could not resolve Railway workspace "${requestedWorkspace}".`);
  console.error("Set RAILWAY_WORKSPACE to a workspace package name, app key, or apps/<app> path.");
  process.exit(1);
}

const manifest = readJson(path.join(rootDir, project.manifestPath));
const scripts = manifest.scripts || {};

const pickScript = (candidates) => candidates.find((scriptName) => scripts[scriptName]);

const buildScript =
  process.env.RAILWAY_BUILD_SCRIPT ||
  pickScript(["railway:build", "db:generate", "prisma:generate", "build:api"]);
const startScript =
  process.env.RAILWAY_START_SCRIPT ||
  pickScript([
    "railway:start",
    "server:with-migrate",
    "server:prod:with-migrate",
    "server:prod",
    "start:api",
    "server",
    "start",
  ]);

const runWorkspaceScript = (scriptName) => {
  const result = spawnSync(
    "pnpm",
    ["--filter", project.name, "run", scriptName],
    {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    },
  );

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
};

if (phase === "build") {
  if (!buildScript) {
    console.log(`No Railway build script needed for ${project.name}.`);
    process.exit(0);
  }

  console.log(`Railway build: ${project.name} -> ${buildScript}`);
  runWorkspaceScript(buildScript);
}

if (!startScript) {
  console.error(`No Railway start script found for ${project.name}.`);
  console.error("Add one of: railway:start, server:with-migrate, server:prod, start:api, server, start.");
  process.exit(1);
}

console.log(`Railway start: ${project.name} -> ${startScript}`);
runWorkspaceScript(startScript);
