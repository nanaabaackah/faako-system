import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Build directly inside the API workspace. Railway needs this artifact in the
// same runtime image as the API; no sibling app's dist directory is required.
// Separate output also prevents parallel workspace builds from racing to clean
// the same Vite dist directory.
const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const output = path.join(apiDirectory, "dist", "cms");

const result = spawnSync("pnpm", [
  "--filter", "@faako/travel-with-ease-portal", "exec",
  "vite", "build", "--outDir", output, "--emptyOutDir",
], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "inherit",
});
if (result.error || result.status !== 0) {
  throw new Error("TWE CMS build failed; refusing to package an incomplete API release.");
}
const html = await readFile(path.join(output, "index.html"), "utf8");
if (!html.includes("<html") || !html.includes("</html>") || !html.includes("/assets/")) {
  throw new Error("TWE CMS build did not create usable HTML and asset references.");
}
const assets = await stat(path.join(output, "assets")).catch(() => null);
if (!assets?.isDirectory()) throw new Error("TWE CMS build did not create frontend assets.");
console.info("TWE CMS assets packaged inside API workspace: apps/travel-with-ease-api/dist/cms");
