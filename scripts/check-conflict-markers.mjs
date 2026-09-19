import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skippedDirectories = new Set([
  ".git",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "generated",
  "test-results",
]);
const sourceExtensions = new Set([
  ".astro", ".cjs", ".css", ".graphql", ".html", ".js", ".jsx", ".json",
  ".md", ".mjs", ".prisma", ".py", ".scss", ".sql", ".toml", ".ts", ".tsx",
  ".yaml", ".yml",
]);
const markerPattern = /^(?:<<<<<<< .+|=======|>>>>>>> .+)$/;
const findings = [];
let checkedFiles = 0;

const visit = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".env")) continue;
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(absolutePath);
      continue;
    }
    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name).toLowerCase())) continue;

    checkedFiles += 1;
    const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (markerPattern.test(line)) {
        findings.push(`${path.relative(repoRoot, absolutePath)}:${index + 1}`);
      }
    });
  }
};

visit(repoRoot);

if (findings.length) {
  console.error("Merge-conflict marker check failed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Merge-conflict marker check passed. Checked ${checkedFiles} source and configuration files.`);
