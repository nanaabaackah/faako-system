import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildHoldingPage } from "./build-holding.mjs";

const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
const flag = process.env.TWE_HOLDING_PAGE || "false";
if (!["true", "false"].includes(flag)) {
  throw new Error("TWE_HOLDING_PAGE must be 'true' or 'false'.");
}

// Git-triggered Pages builds lack the immutable CMS snapshot. Never let
// these replace the public staging/production alias with bundled defaults.
if (process.env.CF_PAGES === "1" && ["main", "develop"].includes(process.env.CF_PAGES_BRANCH) && flag !== "true") {
  throw new Error("Managed TWE branches must be published by the CMS publication worker, not a Git-triggered Pages build.");
}

if (flag === "true") {
  if (process.env.PUBLIC_APP_ENV !== "production") {
    throw new Error("The holding page may only be built with PUBLIC_APP_ENV=production.");
  }
  await buildHoldingPage({ rootDirectory });
} else {
  // Unflagged builds run the same Astro command as before.
  const child = spawnSync("pnpm", ["exec", "astro", "build"], {
    cwd: rootDirectory,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
  });
  if (child.error) throw child.error;
  process.exitCode = child.status ?? 1;
}
