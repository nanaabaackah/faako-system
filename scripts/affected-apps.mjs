import { findWorkspaceRoot, getAffectedApps } from "./workspace-graph.mjs";

const parseArgs = (argv) => {
  const options = {
    files: [],
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--json") {
      options.json = true;
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

const rootDir = findWorkspaceRoot();
const options = parseArgs(process.argv.slice(2));
const result = getAffectedApps({
  rootDir,
  baseRef: options.baseRef,
  headRef: options.headRef,
  files: options.files,
});

if (result.reason && !options.json) {
  console.error(result.reason);
}

const payload = {
  baseRef: result.baseRef,
  headRef: result.headRef,
  changedFiles: result.changedFiles || [],
  changedProjects: result.changedProjects || [],
  isGlobalChange: result.isGlobalChange,
  apps: result.apps.map((app) => ({
    name: app.name,
    dir: app.dir,
  })),
};

if (options.json) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(result.reason ? 1 : 0);
}

if (payload.apps.length === 0) {
  process.exit(result.reason ? 1 : 0);
}

payload.apps.forEach((app) => {
  console.log(app.name);
});
