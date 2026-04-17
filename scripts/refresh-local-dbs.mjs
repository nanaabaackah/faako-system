#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const defaultStateFile = path.join(os.homedir(), ".faako", "local-db-refresh", "state.json");
const defaultBackupDir = path.join(os.homedir(), ".faako", "local-db-refresh", "backups");
const tempRoot = path.join(os.tmpdir(), "faako-local-db-refresh");

const usage = `
Refresh local development databases from production PostgreSQL databases.

Usage:
  pnpm run db:refresh:local -- --dry-run
  pnpm run db:refresh:local -- --yes
  pnpm run db:refresh:local:biweekly

Options:
  --app <name>              Refresh one app. Can be repeated or comma-separated.
  --dry-run                 Show what would run without touching databases.
  --yes                     Required for destructive refreshes.
  --no-backup               Skip the local-target backup before restore.
  --backup-dir <path>       Backup directory. Defaults to ~/.faako/local-db-refresh/backups.
  --due-days <days>         Skip unless the last successful run was at least this many days ago.
  --force                   Ignore --due-days state and run now.
  --state-file <path>       State file used by --due-days.
  --allow-remote-targets    Allow DATABASE_URL_DEVELOPMENT targets that are not localhost.
  --require-local-target    Refuse targets unless the host is localhost/127.0.0.1/::1.
  --list                    List discovered database apps and env status.
  --help                    Show this help.

Environment variables:
  REFRESH_LOCAL_DBS_ALLOW_REMOTE_TARGETS=1
  REFRESH_LOCAL_DBS_BACKUP_DIR=/path/to/backups
  REFRESH_LOCAL_DBS_STATE_FILE=/path/to/state.json
`;

const parseArgs = (argv) => {
  const options = {
    apps: new Set(),
    dryRun: false,
    yes: false,
    backup: true,
    backupDir: process.env.REFRESH_LOCAL_DBS_BACKUP_DIR || defaultBackupDir,
    dueDays: 0,
    force: false,
    stateFile: process.env.REFRESH_LOCAL_DBS_STATE_FILE || defaultStateFile,
    allowRemoteTargets: parseBoolean(process.env.REFRESH_LOCAL_DBS_ALLOW_REMOTE_TARGETS),
    requireLocalTarget: false,
    list: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--no-backup") options.backup = false;
    else if (arg === "--force") options.force = true;
    else if (arg === "--allow-remote-targets") options.allowRemoteTargets = true;
    else if (arg === "--require-local-target") options.requireLocalTarget = true;
    else if (arg === "--list") options.list = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--app") addAppFilters(options.apps, argv[++index] || "");
    else if (arg.startsWith("--app=")) addAppFilters(options.apps, arg.slice("--app=".length));
    else if (arg === "--backup-dir") options.backupDir = argv[++index] || options.backupDir;
    else if (arg.startsWith("--backup-dir=")) options.backupDir = arg.slice("--backup-dir=".length);
    else if (arg === "--state-file") options.stateFile = argv[++index] || options.stateFile;
    else if (arg.startsWith("--state-file=")) options.stateFile = arg.slice("--state-file=".length);
    else if (arg === "--due-days") options.dueDays = Number(argv[++index] || 0);
    else if (arg.startsWith("--due-days=")) options.dueDays = Number(arg.slice("--due-days=".length));
    else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isFinite(options.dueDays) || options.dueDays < 0) {
    throw new Error("--due-days must be a positive number.");
  }

  options.backupDir = path.resolve(workspaceRoot, options.backupDir.replace(/^~(?=$|\/)/, os.homedir()));
  options.stateFile = path.resolve(workspaceRoot, options.stateFile.replace(/^~(?=$|\/)/, os.homedir()));

  return options;
};

const addAppFilters = (apps, value) => {
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => apps.add(item));
};

function parseBoolean(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const parseDotenv = (content) => {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = unquoteDotenvValue(rawValue);
  }
  return values;
};

const unquoteDotenvValue = (value) => {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const quote = trimmed[0];
    const inner = trimmed.slice(1, -1);
    if (quote === "'") return inner;
    return inner
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }
  return trimmed.replace(/\s+#.*$/, "");
};

const discoverDatabaseApps = async () => {
  const appsDir = path.join(workspaceRoot, "apps");
  const entries = await readdir(appsDir, { withFileTypes: true });
  const apps = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const appDir = path.join(appsDir, entry.name);
    const schemaPath = path.join(appDir, "prisma", "schema.prisma");
    const packagePath = path.join(appDir, "package.json");
    let packageName = entry.name;
    let packageJson = {};
    if (existsSync(packagePath)) {
      packageJson = JSON.parse(await readFile(packagePath, "utf8"));
      packageName = packageJson.name || packageName;
    }

    const hasPostgresSchema = existsSync(schemaPath)
      ? /provider\s*=\s*"postgresql"/.test(await readFile(schemaPath, "utf8"))
      : false;
    const hasDatabaseDependency = appHasDatabaseDependency(packageJson);
    const hasDatabaseEnv = await appHasDatabaseEnv(appDir);
    if (!hasPostgresSchema && !hasDatabaseDependency && !hasDatabaseEnv) continue;

    apps.push({
      basename: entry.name,
      name: packageName,
      dir: appDir,
      relativeDir: path.relative(workspaceRoot, appDir),
    });
  }

  return apps.sort((left, right) => left.basename.localeCompare(right.basename));
};

const appHasDatabaseDependency = (packageJson) => {
  const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
  };
  return ["pg", "@prisma/client", "@prisma/adapter-pg", "prisma"].some((name) =>
    Object.prototype.hasOwnProperty.call(dependencies, name),
  );
};

const appHasDatabaseEnv = async (appDir) => {
  for (const file of [".env", ".env.local", ".env.development", ".env.dev", ".env.example"]) {
    const fullPath = path.join(appDir, file);
    if (!existsSync(fullPath)) continue;
    const content = await readFile(fullPath, "utf8");
    if (/DATABASE_URL(?:_PRODUCTION|_DEVELOPMENT|_LOCAL)?\s*=/.test(content)) return true;
  }
  return false;
};

const loadAppEnv = async (app) => {
  const env = {};
  const envFiles = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.dev",
    ".env.dev.local",
  ];

  for (const file of envFiles) {
    const fullPath = path.join(app.dir, file);
    if (!existsSync(fullPath)) continue;
    Object.assign(env, parseDotenv(await readFile(fullPath, "utf8")));
  }

  return { ...env, ...process.env };
};

const resolveDatabasePair = (env) => {
  const targetCandidates = [
    ["DATABASE_URL_DEVELOPMENT", env.DATABASE_URL_DEVELOPMENT],
    ["DATABASE_URL_LOCAL", env.DATABASE_URL_LOCAL],
  ];
  const sourceCandidates = [
    ["DATABASE_URL_PRODUCTION", env.DATABASE_URL_PRODUCTION],
    ["DATABASE_URL", env.DATABASE_URL],
  ];

  const target = targetCandidates.find(([, value]) => hasValue(value));
  const source = sourceCandidates.find(([, value]) => hasValue(value));

  return {
    sourceKey: source?.[0] || "",
    sourceUrl: String(source?.[1] || "").trim(),
    targetKey: target?.[0] || "",
    targetUrl: String(target?.[1] || "").trim(),
  };
};

const hasValue = (value) => String(value || "").trim().length > 0;

const normalizeDatabaseIdentity = (value) => {
  try {
    const parsed = new URL(value);
    return [
      parsed.protocol,
      parsed.hostname.toLowerCase(),
      parsed.port || defaultPortForProtocol(parsed.protocol),
      parsed.pathname.replace(/\/+$/, ""),
    ].join("|");
  } catch {
    return String(value || "").trim();
  }
};

const defaultPortForProtocol = (protocol) => (protocol === "postgresql:" || protocol === "postgres:" ? "5432" : "");

const getHost = (value) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
};

const isLocalDatabaseUrl = (value) => localHosts.has(getHost(value));

const maskDatabaseUrl = (value) => {
  try {
    const parsed = new URL(value);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return value ? "<invalid-url>" : "<missing>";
  }
};

const appMatchesFilters = (app, filters) => {
  if (!filters.size) return true;
  const names = [app.basename, app.name, app.name.replace(/^@[^/]+\//, "")];
  return names.some((name) => filters.has(name));
};

const readState = async (stateFile) => {
  if (!existsSync(stateFile)) return {};
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    return {};
  }
};

const writeState = async (stateFile, state) => {
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
};

const shouldSkipForDueWindow = (state, dueDays) => {
  if (!dueDays) return { skip: false };
  const lastRunAt = state.lastSuccessfulRunAt ? new Date(state.lastSuccessfulRunAt) : null;
  if (!lastRunAt || Number.isNaN(lastRunAt.getTime())) return { skip: false };
  const nextRunAt = new Date(lastRunAt.getTime() + dueDays * 24 * 60 * 60 * 1000);
  if (Date.now() >= nextRunAt.getTime()) return { skip: false };
  return { skip: true, lastRunAt, nextRunAt };
};

const formatDateTime = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

const requireCommand = async (command) => {
  await runCommand(command, ["--version"], { quiet: true });
};

const runCommand = (command, args, { env = process.env, quiet = false, dryRun = false } = {}) => {
  if (dryRun) {
    console.log(`  dry-run: ${formatCommand(command, args)}`);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: quiet ? "ignore" : "inherit",
    });
    child.on("error", (error) => reject(error));
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with ${signal || code}`));
    });
  });
};

const formatCommand = (command, args) => {
  const redacted = args.map((arg, index) => {
    const previous = args[index - 1];
    if (previous === "--dbname") return "<database-url>";
    if (typeof arg === "string" && arg.startsWith("postgres")) return maskDatabaseUrl(arg);
    return shellEscape(arg);
  });
  return [command, ...redacted].join(" ");
};

const shellEscape = (value) => {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\"'\"'")}'`;
};

const getRunPaths = async (app, options) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(tempRoot, stamp);
  if (!options.dryRun) {
    await mkdir(runDir, { recursive: true });
    if (options.backup) await mkdir(options.backupDir, { recursive: true });
  }

  const slug = app.basename.replace(/[^A-Za-z0-9_.-]+/g, "-");
  return {
    sourceDump: path.join(runDir, `${slug}-production.dump`),
    targetBackup: path.join(options.backupDir, `${stamp}-${slug}-before-refresh.dump`),
  };
};

const getCommandEnv = () => ({
  ...process.env,
  PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || "20",
});

const refreshApp = async (app, pair, options) => {
  const paths = await getRunPaths(app, options);
  const commandEnv = getCommandEnv();

  console.log(`\nRefreshing ${app.name} (${app.relativeDir})`);
  console.log(`  source: ${pair.sourceKey} ${maskDatabaseUrl(pair.sourceUrl)}`);
  console.log(`  target: ${pair.targetKey} ${maskDatabaseUrl(pair.targetUrl)}`);

  if (options.backup) {
    console.log(`  backing up target to ${paths.targetBackup}`);
    await runCommand(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl", "--file", paths.targetBackup, "--dbname", pair.targetUrl],
      { env: commandEnv, dryRun: options.dryRun },
    );
  }

  console.log(`  dumping production snapshot to ${paths.sourceDump}`);
  await runCommand(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl", "--file", paths.sourceDump, "--dbname", pair.sourceUrl],
    { env: commandEnv, dryRun: options.dryRun },
  );

  console.log("  clearing target public schema");
  await runCommand(
    "psql",
    [
      "--dbname",
      pair.targetUrl,
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;",
    ],
    { env: commandEnv, dryRun: options.dryRun },
  );

  console.log("  restoring production snapshot into target");
  await runCommand(
    "pg_restore",
    ["--no-owner", "--no-acl", "--dbname", pair.targetUrl, paths.sourceDump],
    { env: commandEnv, dryRun: options.dryRun },
  );
};

const validatePair = (app, pair, options) => {
  const problems = [];
  const warnings = [];

  if (!pair.sourceUrl) problems.push("missing production source (DATABASE_URL_PRODUCTION or DATABASE_URL)");
  if (!pair.targetUrl) problems.push("missing local target (DATABASE_URL_DEVELOPMENT or DATABASE_URL_LOCAL)");

  if (pair.sourceUrl && pair.targetUrl) {
    if (normalizeDatabaseIdentity(pair.sourceUrl) === normalizeDatabaseIdentity(pair.targetUrl)) {
      problems.push("source and target resolve to the same database");
    }
    if (isLocalDatabaseUrl(pair.sourceUrl)) {
      problems.push("production source points at a local host");
    }
    if (options.requireLocalTarget && !isLocalDatabaseUrl(pair.targetUrl)) {
      problems.push("target is not local and --require-local-target was set");
    }
    if (!options.dryRun && !options.allowRemoteTargets && !isLocalDatabaseUrl(pair.targetUrl)) {
      problems.push("target is remote; pass --allow-remote-targets or set REFRESH_LOCAL_DBS_ALLOW_REMOTE_TARGETS=1");
    }
    if (!["DATABASE_URL_DEVELOPMENT", "DATABASE_URL_LOCAL"].includes(pair.targetKey)) {
      problems.push("target must come from DATABASE_URL_DEVELOPMENT or DATABASE_URL_LOCAL");
    }
    if (!isLocalDatabaseUrl(pair.targetUrl)) {
      warnings.push("target host is remote; confirm this is a development database before enabling automation");
    }
  }

  return { app, problems, warnings };
};

const printAppList = (apps, pairs, options) => {
  for (const app of apps) {
    const pair = pairs.get(app.basename);
    const { problems, warnings } = validatePair(app, pair, options);
    const status = problems.length ? "not ready" : "ready";
    console.log(`${app.name} (${app.relativeDir}): ${status}`);
    console.log(`  source: ${pair.sourceKey || "<missing>"}`);
    console.log(`  target: ${pair.targetKey || "<missing>"}`);
    for (const warning of warnings) console.log(`  warning: ${warning}`);
    for (const problem of problems) console.log(`  problem: ${problem}`);
  }
};

const hashRunInputs = (apps, pairs) => {
  const hash = createHash("sha256");
  for (const app of apps) {
    const pair = pairs.get(app.basename);
    hash.update(app.basename);
    hash.update(normalizeDatabaseIdentity(pair.sourceUrl));
    hash.update(normalizeDatabaseIdentity(pair.targetUrl));
  }
  return hash.digest("hex").slice(0, 16);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage.trim());
    return;
  }

  const discoveredApps = await discoverDatabaseApps();
  const selectedApps = discoveredApps.filter((app) => appMatchesFilters(app, options.apps));
  if (!selectedApps.length) {
    throw new Error("No database apps matched the provided filters.");
  }

  const pairs = new Map();
  for (const app of selectedApps) {
    pairs.set(app.basename, resolveDatabasePair(await loadAppEnv(app)));
  }

  if (options.list) {
    printAppList(selectedApps, pairs, options);
    return;
  }

  const state = await readState(options.stateFile);
  const due = shouldSkipForDueWindow(state, options.dueDays);
  if (due.skip && !options.force) {
    console.log(
      `Local DB refresh is not due yet. Last success: ${formatDateTime(due.lastRunAt)}. Next run: ${formatDateTime(due.nextRunAt)}.`,
    );
    return;
  }

  if (!options.dryRun && !options.yes) {
    throw new Error("This refresh replaces local/development data. Re-run with --yes after checking --dry-run.");
  }

  if (!options.dryRun) {
    await Promise.all(["pg_dump", "pg_restore", "psql"].map(requireCommand));
  }

  const runnableApps = [];
  for (const app of selectedApps) {
    const pair = pairs.get(app.basename);
    const validation = validatePair(app, pair, options);
    if (validation.warnings.length) {
      for (const warning of validation.warnings) {
        console.log(`${app.name}: warning: ${warning}`);
      }
    }
    if (validation.problems.length) {
      console.log(`${app.name}: skipped: ${validation.problems.join("; ")}`);
      continue;
    }
    runnableApps.push(app);
  }

  if (!runnableApps.length) {
    throw new Error("No databases were safe to refresh. Run --list or --dry-run for details.");
  }

  for (const app of runnableApps) {
    await refreshApp(app, pairs.get(app.basename), options);
  }

  if (!options.dryRun) {
    const now = new Date().toISOString();
    await writeState(options.stateFile, {
      ...state,
      lastSuccessfulRunAt: now,
      lastRunInputHash: hashRunInputs(runnableApps, pairs),
      apps: Object.fromEntries(
        runnableApps.map((app) => [
          app.basename,
          {
            name: app.name,
            relativeDir: app.relativeDir,
            refreshedAt: now,
          },
        ]),
      ),
    });
  }

  console.log(options.dryRun ? "\nDry run complete." : "\nLocal database refresh complete.");
};

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
