import fs from "node:fs";
import path from "node:path";
import { findWorkspaceRoot, getWorkspaceGraph } from "./workspace-graph.mjs";

const rootDir = findWorkspaceRoot();
const graph = getWorkspaceGraph(rootDir);
const findings = [];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const readText = (filePath) => fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";

const hasAnyScript = (scripts = {}, names = []) => names.some((name) => Boolean(scripts[name]));

const hasDependency = (manifest = {}, name) =>
  Boolean(
    manifest.dependencies?.[name] ||
    manifest.devDependencies?.[name] ||
    manifest.peerDependencies?.[name] ||
    manifest.optionalDependencies?.[name]
  );

const hasViteConfig = (appDir) =>
  ["vite.config.js", "vite.config.mjs", "vite.config.ts"].some((fileName) =>
    fs.existsSync(path.join(appDir, fileName))
  );

const hasApiEntrypoint = (appDir, scripts = {}) =>
  fs.existsSync(path.join(appDir, "backend", "server.js")) ||
  fs.existsSync(path.join(appDir, "src", "server.js")) ||
  hasAnyScript(scripts, ["railway:start", "server:with-migrate", "server:prod", "start:api", "server"]);

const hasPrisma = (appDir, manifest = {}) =>
  fs.existsSync(path.join(appDir, "prisma")) || hasDependency(manifest, "@prisma/client");

const assertCloudflareFiles = ({ appLabel, appDir, requiresSpaFallback }) => {
  const headersPath = path.join(appDir, "public", "_headers");
  const redirectsPath = path.join(appDir, "public", "_redirects");
  const headers = readText(headersPath).toLowerCase();
  const redirects = readText(redirectsPath).toLowerCase();

  if (!headers) {
    findings.push(`[cloudflare] ${appLabel}: missing public/_headers`);
  } else {
    if (!headers.includes("content-security-policy")) {
      findings.push(`[cloudflare] ${appLabel}: public/_headers is missing Content-Security-Policy`);
    }
    if (!headers.includes("x-content-type-options")) {
      findings.push(`[cloudflare] ${appLabel}: public/_headers is missing X-Content-Type-Options`);
    }
  }

  if (requiresSpaFallback && !redirects) {
    findings.push(`[cloudflare] ${appLabel}: missing public/_redirects`);
  } else if (requiresSpaFallback && !redirects.includes("/index.html 200")) {
    findings.push(`[cloudflare] ${appLabel}: public/_redirects should include an SPA fallback to /index.html 200`);
  }
};

const assertRailwayScripts = ({ appLabel, appDir, manifest }) => {
  const scripts = manifest.scripts || {};
  if (!hasAnyScript(scripts, ["railway:start", "server:with-migrate", "server:prod", "start:api", "server", "start"])) {
    findings.push(`[railway] ${appLabel}: missing a Railway-compatible start script`);
  }

  if (hasPrisma(appDir, manifest) && !hasAnyScript(scripts, ["railway:build", "db:generate", "prisma:generate"])) {
    findings.push(`[railway] ${appLabel}: Prisma apps should expose db:generate, prisma:generate, or railway:build`);
  }
};

const assertNoLegacyProviderFiles = ({ appLabel, appDir, manifest }) => {
  const legacyPaths = [
    "netlify.toml",
    "netlify",
    ".netlify",
    "scripts/netlify-ignore.mjs",
  ];

  for (const relativePath of legacyPaths) {
    if (fs.existsSync(path.join(appDir, relativePath))) {
      findings.push(`[legacy-hosting] ${appLabel}: remove ${relativePath}`);
    }
  }

  const allDependencies = {
    ...(manifest.dependencies || {}),
    ...(manifest.devDependencies || {}),
  };
  for (const dependencyName of ["netlify", "netlify-cli"]) {
    if (allDependencies[dependencyName]) {
      findings.push(`[legacy-hosting] ${appLabel}: remove ${dependencyName} from package dependencies`);
    }
  }

  for (const [scriptName, scriptValue] of Object.entries(manifest.scripts || {})) {
    if (/netlify/i.test(String(scriptName)) || /netlify/i.test(String(scriptValue))) {
      findings.push(`[legacy-hosting] ${appLabel}: remove Netlify reference from script "${scriptName}"`);
    }
  }
};

const nixpacksPath = path.join(rootDir, "nixpacks.toml");
const nixpacks = readText(nixpacksPath);
if (!nixpacks.includes("scripts/railway-service.mjs")) {
  findings.push("[railway] root nixpacks.toml should use scripts/railway-service.mjs");
}

for (const project of graph.apps) {
  const appDir = path.join(rootDir, project.dir);
  const manifest = readJson(path.join(rootDir, project.manifestPath));
  const appLabel = manifest.name || project.dir;
  const scripts = manifest.scripts || {};
  const isAstroApp = hasDependency(manifest, "astro") || /astro build/.test(String(scripts.build || ""));
  const isViteApp = hasDependency(manifest, "vite") || /vite build/.test(String(scripts.build || "")) || hasViteConfig(appDir);
  const isStaticApp = isAstroApp || isViteApp;
  const isApiApp = hasApiEntrypoint(appDir, scripts);

  assertNoLegacyProviderFiles({ appLabel, appDir, manifest });

  if (isStaticApp) {
    assertCloudflareFiles({ appLabel, appDir, requiresSpaFallback: isViteApp && !isAstroApp });
  }

  if (isApiApp) {
    assertRailwayScripts({ appLabel, appDir, manifest });
  }
}

if (findings.length) {
  console.error("Cloudflare/Railway readiness check failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Cloudflare/Railway readiness check passed. Static apps have Cloudflare files, API apps have Railway start paths, and legacy hosting artifacts are absent.");
