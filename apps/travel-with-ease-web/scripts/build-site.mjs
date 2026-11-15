import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildHoldingPage } from "./build-holding.mjs";

const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
const flag = process.env.TWE_HOLDING_PAGE || "false";
if (!["true", "false"].includes(flag)) {
  throw new Error("TWE_HOLDING_PAGE must be 'true' or 'false'.");
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
