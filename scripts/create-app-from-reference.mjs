import fs from "node:fs";
import path from "node:path";
import {
  MONOREPO_APP_REGISTRY,
  PORTFOLIO_PROJECT_REGISTRY,
} from "../packages/config/src/index.js";
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
const TEXT_FILE_BASENAMES = new Set([
  "README",
  "_headers",
  "_redirects",
]);
const SKIP_DIRECTORIES = new Set([
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
const DEFAULT_CLOUDFLARE_HEADERS = `/*
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: http://localhost:* ws: wss:; manifest-src 'self'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
`;
const DEFAULT_CLOUDFLARE_REDIRECTS = "/* /index.html 200\n";
const TITLE_WORD_OVERRIDES = new Map([
  ["api", "API"],
  ["crm", "CRM"],
  ["erp", "ERP"],
  ["hr", "HR"],
  ["pos", "POS"],
  ["ui", "UI"],
]);

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
  const basename = path.basename(filePath);
  if (!TEXT_FILE_EXTENSIONS.has(extension) && !TEXT_FILE_BASENAMES.has(basename)) {
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

const quote = (value) => JSON.stringify(value);

const toDisplayTitle = (value) =>
  String(value || "")
    .split("-")
    .filter(Boolean)
    .map((word) => TITLE_WORD_OVERRIDES.get(word) || `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");

const toEnvPrefix = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toArrayLiteral = (values = [], indent = 4) => {
  const padding = " ".repeat(indent);
  const itemPadding = " ".repeat(indent + 2);
  if (!values.length) return "[]";
  return `[\n${values.map((value) => `${itemPadding}${quote(value)},`).join("\n")}\n${padding}]`;
};

const toMonitoringPagesLiteral = (pages = []) => {
  if (!pages.length) return "[]";
  return `[\n${pages
    .map((page) => `      { label: ${quote(page.label)}, path: ${quote(page.path)} },`)
    .join("\n")}\n    ]`;
};

const findSourceRegistryApp = (sourceApp) =>
  MONOREPO_APP_REGISTRY.find((app) => app.key === sourceApp || app.path === `apps/${sourceApp}`) || null;

const inferMonitoringCategory = ({ sourceRegistryApp, targetApp }) => {
  const normalizedTarget = String(targetApp || "");
  const sourceCategory = sourceRegistryApp?.category;

  if (/(^|-)api($|-)/.test(normalizedTarget)) return "api";
  if (/(^|-)(erp|portal|admin)($|-)/.test(normalizedTarget)) return "erp";
  if (/(^|-)(store|shop|commerce)($|-)/.test(normalizedTarget)) return "commerce";
  if (/(^|-)(site|website|marketing)($|-)/.test(normalizedTarget)) return "marketing";
  if (sourceCategory && sourceCategory !== "internal") return sourceCategory;
  return "client";
};

const defaultMonitoringPagesForCategory = (category, sourceRegistryApp) => {
  if (sourceRegistryApp?.category !== "internal" && Array.isArray(sourceRegistryApp?.monitoringPages)) {
    return sourceRegistryApp.monitoringPages
      .filter((page) => page?.path)
      .map((page) => ({
        label: page.label || page.path,
        path: page.path,
      }));
  }

  if (category === "api") {
    return [{ label: "Health", path: "/api/health" }];
  }

  if (category === "erp") {
    return [
      { label: "Dashboard", path: "/" },
      { label: "Login", path: "/login" },
      { label: "Health", path: "/health" },
    ];
  }

  return [{ label: "Home", path: "/" }];
};

const inferProjectType = (category) => {
  if (category === "api") return "API / Backend Service";
  if (category === "erp") return "ERP / Portal App";
  if (category === "commerce") return "Commerce Website";
  if (category === "marketing") return "Marketing Website";
  if (category === "portfolio") return "Portfolio Website";
  return "Client App";
};

const inferTechStack = (targetDir, targetManifest) => {
  const dependencies = {
    ...(targetManifest.dependencies || {}),
    ...(targetManifest.devDependencies || {}),
  };
  const stack = new Set(["Faako monorepo"]);

  if (dependencies.react) stack.add("React");
  if (dependencies.astro) stack.add("Astro");
  if (dependencies.vite) stack.add("Vite");
  if (dependencies.typescript || fs.existsSync(path.join(targetDir, "tsconfig.json"))) {
    stack.add("TypeScript");
  }
  if (dependencies.express) stack.add("Express");
  if (dependencies["@prisma/client"] || fs.existsSync(path.join(targetDir, "prisma"))) {
    stack.add("Prisma");
  }
  if (dependencies.vite || dependencies.astro) stack.add("Cloudflare Pages-ready");
  if (dependencies.express || fs.existsSync(path.join(targetDir, "backend", "server.js"))) {
    stack.add("Railway-ready");
  }
  if (dependencies["@faako/ui"]) stack.add("@faako/ui");
  if (dependencies["@faako/config"]) stack.add("@faako/config");

  return [...stack];
};

const isStaticCloudflareApp = (targetDir, targetManifest) => {
  const dependencies = {
    ...(targetManifest.dependencies || {}),
    ...(targetManifest.devDependencies || {}),
  };
  const scripts = targetManifest.scripts || {};

  return Boolean(
    dependencies.astro ||
    dependencies.vite ||
    /astro build/.test(String(scripts.build || "")) ||
    /vite build/.test(String(scripts.build || "")) ||
    ["vite.config.js", "vite.config.mjs", "vite.config.ts"].some((fileName) =>
      fs.existsSync(path.join(targetDir, fileName))
    )
  );
};

const ensureCloudflarePagesFiles = ({ targetDir, targetManifest }) => {
  if (!isStaticCloudflareApp(targetDir, targetManifest)) return false;

  const publicDir = path.join(targetDir, "public");
  fs.mkdirSync(publicDir, { recursive: true });

  const headersPath = path.join(publicDir, "_headers");
  const redirectsPath = path.join(publicDir, "_redirects");
  let changed = false;

  if (!fs.existsSync(headersPath)) {
    fs.writeFileSync(headersPath, DEFAULT_CLOUDFLARE_HEADERS);
    changed = true;
  }

  const isAstroApp = Boolean(
    targetManifest.dependencies?.astro ||
    targetManifest.devDependencies?.astro ||
    /astro build/.test(String(targetManifest.scripts?.build || ""))
  );

  if (!isAstroApp && !fs.existsSync(redirectsPath)) {
    fs.writeFileSync(redirectsPath, DEFAULT_CLOUDFLARE_REDIRECTS);
    changed = true;
  }

  return changed;
};

const formatMonorepoAppRegistryEntry = ({
  key,
  packageName,
  appPath,
  title,
  purpose,
  category,
  envBaseUrlKeys,
  monitoringPages,
}) => `  {
    key: ${quote(key)},
    packageName: ${quote(packageName)},
    path: ${quote(appPath)},
    title: ${quote(title)},
    purpose: ${quote(purpose)},
    category: ${quote(category)},
    productionSensitive: false,
    monitoringEnabled: true,
    monitoringOptional: true,
    envBaseUrlKeys: ${toArrayLiteral(envBaseUrlKeys, 4)},
    monitoringPages: ${toMonitoringPagesLiteral(monitoringPages)},
  },
`;

const formatPortfolioProjectRegistryEntry = ({
  key,
  appPath,
  projectName,
  projectType,
  shortDescription,
  longDescription,
  techStack,
  features,
  latestMilestone,
  lastUpdated,
  relatedDocsPath,
  notes,
}) => `  {
    key: ${quote(key)},
    appKey: ${quote(key)},
    appPath: ${quote(appPath)},
    projectName: ${quote(projectName)},
    projectType: ${quote(projectType)},
    status: "foundation",
    visibility: PROJECT_VISIBILITY.PRIVATE,
    clientPublic: false,
    privateInternal: true,
    caseStudyEnabled: false,
    caseStudyStatus: PROJECT_CASE_STUDY_STATUS.DISABLED,
    shortDescription: ${quote(shortDescription)},
    longDescription: ${quote(longDescription)},
    techStack: ${toArrayLiteral(techStack, 4)},
    features: ${toArrayLiteral(features, 4)},
    liveUrl: "",
    screenshots: [],
    screenshotPlaceholders: ${toArrayLiteral(["Primary app screen", "Future deployed health check"], 4)},
    latestMilestone: ${quote(latestMilestone)},
    lastUpdated: ${quote(lastUpdated)},
    relatedDocsPath: ${quote(relatedDocsPath)},
    notes: ${quote(notes)},
  },
`;

const insertIntoExportedArray = ({ filePath, arrayName, entryText }) => {
  const content = fs.readFileSync(filePath, "utf8");
  const startMarker = `export const ${arrayName} = [`;
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`Could not find ${arrayName} in ${filePath}.`);
  }

  const endIndex = content.indexOf("\n];", startIndex);
  if (endIndex === -1) {
    throw new Error(`Could not find the end of ${arrayName} in ${filePath}.`);
  }

  fs.writeFileSync(filePath, `${content.slice(0, endIndex)}${entryText}${content.slice(endIndex)}`);
};

const ensureMonorepoRegistryEntry = ({
  rootDir,
  sourceApp,
  targetApp,
  packageName,
  targetDir,
  targetManifest,
}) => {
  const appPath = `apps/${targetApp}`;
  if (MONOREPO_APP_REGISTRY.some((app) => app.key === targetApp || app.path === appPath)) {
    return false;
  }

  const sourceRegistryApp = findSourceRegistryApp(sourceApp);
  const category = inferMonitoringCategory({ sourceRegistryApp, targetApp });
  const title = toDisplayTitle(targetApp);
  const envPrefix = toEnvPrefix(targetApp);
  const entryText = formatMonorepoAppRegistryEntry({
    key: targetApp,
    packageName,
    appPath,
    title,
    purpose: `Auto-registered app workspace created from apps/${sourceApp}.`,
    category,
    envBaseUrlKeys: [`${envPrefix}_BASE_URL`, `${envPrefix}_URL`],
    monitoringPages: defaultMonitoringPagesForCategory(category, sourceRegistryApp),
    targetDir,
    targetManifest,
  });

  insertIntoExportedArray({
    filePath: path.join(rootDir, "packages/config/src/monorepoApps/appRegistry.js"),
    arrayName: "MONOREPO_APP_REGISTRY",
    entryText,
  });

  return true;
};

const ensurePortfolioProjectEntry = ({
  rootDir,
  sourceApp,
  targetApp,
  targetDir,
  targetManifest,
}) => {
  const appPath = `apps/${targetApp}`;
  if (PORTFOLIO_PROJECT_REGISTRY.some((project) => project.key === targetApp || project.appPath === appPath)) {
    return false;
  }

  const sourceRegistryApp = findSourceRegistryApp(sourceApp);
  const category = inferMonitoringCategory({ sourceRegistryApp, targetApp });
  const title = toDisplayTitle(targetApp);
  const today = new Date().toISOString().slice(0, 10);
  const entryText = formatPortfolioProjectRegistryEntry({
    key: targetApp,
    appPath,
    projectName: title,
    projectType: inferProjectType(category),
    shortDescription: `Auto-created portfolio metadata for ${title}.`,
    longDescription:
      "Generated by the app creation workflow. Review positioning, screenshots, live URLs, client visibility, and case-study readiness before publishing.",
    techStack: inferTechStack(targetDir, targetManifest),
    features: [
      `Scaffolded from apps/${sourceApp}`,
      "Monitoring registry foundation",
      "Portfolio metadata foundation",
    ],
    latestMilestone: "App scaffold created",
    lastUpdated: today,
    relatedDocsPath: `docs/apps/${targetApp}`,
    notes:
      "Auto-created by pnpm create:app. Keep private until the project has approved copy, screenshots, and a reviewed public publishing decision.",
  });

  insertIntoExportedArray({
    filePath: path.join(rootDir, "packages/config/src/projectRegistry/projectRegistry.js"),
    arrayName: "PORTFOLIO_PROJECT_REGISTRY",
    entryText,
  });

  return true;
};

const ensureProjectDocsScaffold = ({ rootDir, sourceApp, targetApp, title }) => {
  const docsDir = path.join(rootDir, "docs/apps", targetApp);
  const readmePath = path.join(docsDir, "README.md");

  fs.mkdirSync(docsDir, { recursive: true });
  if (fs.existsSync(readmePath)) return false;

  fs.writeFileSync(
    readmePath,
    `# ${title}\n\nAuto-created project notes for apps/${targetApp}.\n\n- Source app: apps/${sourceApp}\n- Cloudflare Pages: keep static frontend builds pointed at the app build command and publish directory.\n- Railway: for API services, set \`RAILWAY_WORKSPACE=${targetApp}\` or \`RAILWAY_WORKSPACE=<workspace-package>\` so the root Nixpacks config starts the right app.\n- Review branding, copy, routes, deployment URLs, screenshots, and portfolio visibility before publishing.\n- Keep client-sensitive details private until approved.\n`,
  );
  return true;
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
  const cloudflareFilesCreated = ensureCloudflarePagesFiles({
    targetDir,
    targetManifest,
  });

  const title = toDisplayTitle(targetApp);
  const monitoringRegistered = ensureMonorepoRegistryEntry({
    rootDir,
    sourceApp: options.sourceApp,
    targetApp,
    packageName: options.packageName,
    targetDir,
    targetManifest,
  });
  const portfolioRegistered = ensurePortfolioProjectEntry({
    rootDir,
    sourceApp: options.sourceApp,
    targetApp,
    targetDir,
    targetManifest,
  });
  const docsCreated = ensureProjectDocsScaffold({
    rootDir,
    sourceApp: options.sourceApp,
    targetApp,
    title,
  });

  console.log(`Created apps/${targetApp} from apps/${options.sourceApp}.`);
  console.log(
    monitoringRegistered
      ? `Added apps/${targetApp} to monorepo monitoring registry.`
      : `Skipped monitoring registry insert because apps/${targetApp} is already registered.`,
  );
  console.log(
    portfolioRegistered
      ? `Added apps/${targetApp} to byNana portfolio project registry as a private draft.`
      : `Skipped portfolio project registry insert because apps/${targetApp} is already registered.`,
  );
  console.log(
    docsCreated
      ? `Created docs/apps/${targetApp}/README.md.`
      : `Skipped docs scaffold because docs/apps/${targetApp}/README.md already exists.`,
  );
  console.log(
    cloudflareFilesCreated
      ? `Added Cloudflare Pages _headers/_redirects defaults to apps/${targetApp}.`
      : `Cloudflare Pages files already present or not needed for apps/${targetApp}.`,
  );
  console.log("Manual follow-up:");
  console.log("- Update company branding, copy, logos, and env values inside the new app.");
  console.log("- Search the new app for source-company wording and replace it intentionally.");
  console.log("- Review monitoring URLs, project description, screenshots, and portfolio visibility before publishing.");
  console.log("- For Cloudflare Pages, set the app build command and publish directory; for Railway APIs, set RAILWAY_WORKSPACE.");
  console.log("- If this app depends on another app at build time, add that relationship to workspace-links.json.");
  console.log("- Keep secrets only in local or hosted env settings; the clone intentionally skips env and key material.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
