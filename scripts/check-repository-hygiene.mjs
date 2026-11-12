import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Inspect the index, not ignored developer installs or neighbouring worktrees.
const cwd = fileURLToPath(new URL("../", import.meta.url));
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8" }).split("\0").filter(Boolean);
const generated = /(?:^|\/)(?:node_modules|dist|\.astro|\.turbo|\.probe_tmp|playwright-report|test-results)(?:\/|$)/;
const failures = tracked.filter(path => generated.test(path));
if (failures.length) {
  console.error("Generated files must not be tracked:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Repository hygiene: no tracked dependencies, builds, Astro caches, probes or browser reports.");
}
