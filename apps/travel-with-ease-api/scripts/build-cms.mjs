import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The CMS is an asset of the existing API Railway service, not a second runtime.
// Copy it under this workspace so a runtime/image assembled from the API package
// cannot drop the sibling portal's generated dist directory.
const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const input = path.join(workspaceRoot, "apps", "travel-with-ease-portal", "dist");
const output = path.join(apiDirectory, "dist", "cms");

const result = spawnSync("pnpm", ["--filter", "@faako/travel-with-ease-portal", "build"], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "inherit",
});
if (result.error || result.status !== 0) {
  throw new Error("TWE CMS build failed; refusing to package an incomplete API release.");
}
const sourceIndex = path.join(input, "index.html");
const source = await readFile(sourceIndex, "utf8");
if (!source.includes("<html") || !source.includes("</html>")) {
  throw new Error("TWE CMS build did not create a valid index.html.");
}
const assets = await stat(path.join(input, "assets")).catch(() => null);
if (!assets?.isDirectory()) throw new Error("TWE CMS build did not create frontend assets.");

// A generated folder under the API workspace survives runtime packaging.
// Stage first, and publish only after the copy succeeds.
const staging = await mkdtemp(path.join(os.tmpdir(), "twe-cms-build-"));
try {
  await cp(input, staging, { recursive: true, force: true });
  await rm(output, { recursive: true, force: true });
  await cp(staging, output, { recursive: true, force: true });
} finally {
  await rm(staging, { recursive: true, force: true });
}
await readFile(path.join(output, "index.html"), "utf8");
console.info("TWE CMS assets packaged inside API workspace: apps/travel-with-ease-api/dist/cms");
