import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(scriptDir, "..");
const sourceDir = resolve(websiteRoot, "../faako-api/netlify/functions");
const targetDir = resolve(websiteRoot, "netlify/functions");
const runtimeConfigSource = resolve(websiteRoot, "../faako-api/src/runtimeConfig.js");
const runtimeConfigTarget = resolve(websiteRoot, "src/runtimeConfig.js");

if (!existsSync(sourceDir)) {
  throw new Error(`Netlify functions source directory not found: ${sourceDir}`);
}

if (!existsSync(runtimeConfigSource)) {
  throw new Error(`Runtime config source not found: ${runtimeConfigSource}`);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
  if (!entry.isFile()) {
    continue;
  }

  cpSync(resolve(sourceDir, entry.name), resolve(targetDir, entry.name));
}

cpSync(runtimeConfigSource, runtimeConfigTarget);
