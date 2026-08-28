import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const serviceDirectory = resolve("services/reebs-analytics");
const configuredPython = process.env.REEBS_ANALYTICS_PYTHON;
const localPython =
  process.platform === "win32"
    ? resolve(serviceDirectory, ".venv/Scripts/python.exe")
    : resolve(serviceDirectory, ".venv/bin/python");

const candidates = [
  configuredPython,
  existsSync(localPython) ? localPython : undefined,
  process.platform === "win32" ? "python" : "python3",
  "python",
].filter(Boolean);

let result;
let pythonCommand;

for (const candidate of candidates) {
  const probe = spawnSync(candidate, ["--version"], { stdio: "ignore" });
  if (!probe.error) {
    pythonCommand = candidate;
    result = spawnSync(
      candidate,
      ["-m", "pytest", serviceDirectory, "--disable-warnings"],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
      },
    );
    break;
  }
}

if (!pythonCommand) {
  console.error("No Python interpreter was found.");
  process.exit(1);
}

if (result?.status !== 0) {
  console.error(
    "\nShared analytics tests require an isolated Python environment. " +
      "Create services/reebs-analytics/.venv, install the service's dev dependencies, " +
      "then rerun pnpm test:python.",
  );
  process.exit(result?.status ?? 1);
}
