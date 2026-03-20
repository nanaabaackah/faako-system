import { findWorkspaceRoot, getAffectedApps } from "./workspace-graph.mjs";

const parseArgs = (argv) => {
  const options = {
    files: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith("--") && !options.appName) {
      options.appName = argument;
      continue;
    }

    if (argument === "--app" && argv[index + 1]) {
      options.appName = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--app=")) {
      options.appName = argument.slice("--app=".length);
      continue;
    }

    if (argument === "--base" && argv[index + 1]) {
      options.baseRef = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--base=")) {
      options.baseRef = argument.slice("--base=".length);
      continue;
    }

    if (argument === "--head" && argv[index + 1]) {
      options.headRef = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--head=")) {
      options.headRef = argument.slice("--head=".length);
      continue;
    }

    if (argument === "--files") {
      while (argv[index + 1] && !argv[index + 1].startsWith("--")) {
        options.files.push(argv[index + 1]);
        index += 1;
      }
      continue;
    }

    if (argument.startsWith("--files=")) {
      options.files.push(...argument.slice("--files=".length).split(","));
    }
  }

  options.files = options.files.map((value) => value.trim()).filter(Boolean);
  return options;
};

const options = parseArgs(process.argv.slice(2));

if (!options.appName) {
  console.error("Usage: node ./scripts/netlify-ignore.mjs <workspace-package-name>");
  process.exit(1);
}

const rootDir = findWorkspaceRoot();
const baseRef = options.baseRef || process.env.CACHED_COMMIT_REF || "";
const headRef = options.headRef || process.env.COMMIT_REF || "HEAD";
const result = getAffectedApps({
  rootDir,
  baseRef,
  headRef,
  files: options.files,
});

if (result.reason) {
  console.log(
    `Building ${options.appName}: ${result.reason}`,
  );
  process.exit(1);
}

const affectedAppNames = new Set(result.apps.map((app) => app.name));
const shouldBuild = affectedAppNames.has(options.appName);

if (shouldBuild) {
  const changedSummary = result.changedFiles.length
    ? `matched ${result.changedFiles.length} changed file(s)`
    : "matched a global workspace change";

  console.log(`Building ${options.appName}: ${changedSummary}.`);
  process.exit(1);
}

console.log(`Skipping ${options.appName}: no relevant changes detected.`);
process.exit(0);
