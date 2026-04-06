import fs from "node:fs";
import path from "node:path";
import { findWorkspaceRoot } from "./workspace-graph.mjs";

const TEXT_FILE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);
const SKIP_DIRECTORIES = new Set([
  ".netlify",
  ".turbo",
  "dist",
  "node_modules",
]);
const SENSITIVE_FILE_EXTENSIONS = new Set([
  ".asc",
  ".cer",
  ".crt",
  ".der",
  ".jks",
  ".key",
  ".keystore",
  ".p12",
  ".pem",
  ".pfx",
]);
const SENSITIVE_BASENAMES = new Set([
  ".netrc",
  ".npmrc",
  ".yarnrc",
  ".yarnrc.yml",
]);
const APP_DIR_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WORKSPACE_PACKAGE_NAME_PATTERN = /^@[a-z0-9-]+\/[a-z0-9][a-z0-9-]*$/;

const parseArgs = (argv) => {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--source" && argv[index + 1]) {
      options.sourceApp = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--source=")) {
      options.sourceApp = argument.slice("--source=".length);
      continue;
    }

    if (argument === "--target" && argv[index + 1]) {
      options.targetApp = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--target=")) {
      options.targetApp = argument.slice("--target=".length);
      continue;
    }

    if (argument === "--package" && argv[index + 1]) {
      options.packageName = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--package=")) {
      options.packageName = argument.slice("--package=".length);
    }
  }

  return options;
};

const assertSafeAppDirName = (value, label) => {
  if (!APP_DIR_NAME_PATTERN.test(String(value || ""))) {
    throw new Error(
      `${label} must use lowercase letters, digits, and hyphens only.`,
    );
  }
};

const assertSafeWorkspacePackageName = (value) => {
  if (!WORKSPACE_PACKAGE_NAME_PATTERN.test(String(value || ""))) {
    throw new Error(
      "Package names must look like @scope/app-name and use lowercase letters, digits, and hyphens only.",
    );
  }
};

const assertPathInside = (baseDir, targetPath, label) => {
  const relativePath = path.relative(baseDir, targetPath);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`${label} must stay inside ${baseDir}.`);
  }
};

const shouldCopyPath = (sourceRoot, currentPath) => {
  const relativePath = path.relative(sourceRoot, currentPath);
  if (!relativePath) return true;

  const baseName = path.basename(currentPath);
  const stats = fs.statSync(currentPath);

  if (stats.isDirectory()) {
    return !SKIP_DIRECTORIES.has(baseName);
  }

  if (SENSITIVE_BASENAMES.has(baseName)) {
    return false;
  }

  if (baseName === ".env") {
    return false;
  }

  if (baseName.startsWith(".env.") && baseName !== ".env.example") {
    return false;
  }

  if (SENSITIVE_FILE_EXTENSIONS.has(path.extname(baseName).toLowerCase())) {
    return false;
  }

  return true;
};

const walkFiles = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
      return;
    }

    files.push(entryPath);
  });

  return files;
};

const replaceInTextFile = (filePath, replacements) => {
  const extension = path.extname(filePath).toLowerCase();
  if (!TEXT_FILE_EXTENSIONS.has(extension) && path.basename(filePath) !== "README") {
    return;
  }

  const originalContent = fs.readFileSync(filePath, "utf8");
  let nextContent = originalContent;

  replacements.forEach(([fromValue, toValue]) => {
    if (!fromValue || fromValue === toValue) return;
    nextContent = nextContent.split(fromValue).join(toValue);
  });

  if (nextContent !== originalContent) {
    fs.writeFileSync(filePath, nextContent);
  }
};

const rootDir = findWorkspaceRoot();
const options = parseArgs(process.argv.slice(2));

  if (!options.packageName) {
    console.error(
    "Usage: pnpm create:app -- --package <workspace-package-name> [--target <new-app-dir>] [--source <existing-app-dir>] (defaults to system-starter)",
  );
    process.exit(1);
  }

try {
  options.sourceApp = options.sourceApp || "system-starter";
  assertSafeAppDirName(options.sourceApp, "Source app");
  assertSafeWorkspacePackageName(options.packageName);

  const appsDir = path.join(rootDir, "apps");
  const sourceDir = path.resolve(appsDir, options.sourceApp);
  assertPathInside(appsDir, sourceDir, "Source app path");
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source app "${options.sourceApp}" does not exist under apps/.`);
    process.exit(1);
  }

  const sourceManifest = JSON.parse(fs.readFileSync(path.join(sourceDir, "package.json"), "utf8"));
  const targetApp =
    options.targetApp
    || options.packageName.split("/").pop()
    || options.packageName.replace(/^@/, "").replace(/\//g, "-");
  assertSafeAppDirName(targetApp, "Target app");
  const targetDir = path.resolve(appsDir, targetApp);
  assertPathInside(appsDir, targetDir, "Target app path");

  if (fs.existsSync(targetDir)) {
    console.error(`Target app directory "apps/${targetApp}" already exists.`);
    process.exit(1);
  }

  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (currentPath) => shouldCopyPath(sourceDir, currentPath),
  });

  const targetManifestPath = path.join(targetDir, "package.json");
  const targetManifest = JSON.parse(fs.readFileSync(targetManifestPath, "utf8"));
  targetManifest.name = options.packageName;
  fs.writeFileSync(targetManifestPath, `${JSON.stringify(targetManifest, null, 2)}\n`);

  const replacements = [
    [sourceManifest.name, options.packageName],
    [`apps/${options.sourceApp}`, `apps/${targetApp}`],
    [`/apps/${options.sourceApp}/`, `/apps/${targetApp}/`],
  ];

  walkFiles(targetDir).forEach((filePath) => {
    replaceInTextFile(filePath, replacements);
  });

  console.log(`Created apps/${targetApp} from apps/${options.sourceApp}.`);
  console.log("Manual follow-up:");
  console.log("- Update company branding, copy, logos, and env values inside the new app.");
  console.log("- Search the new app for source-company wording and replace it intentionally.");
  console.log("- If this app mirrors another app at build time, add that relationship to workspace-links.json.");
  console.log("- Keep secrets only in local or hosted env settings; the clone intentionally skips env and key material.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
