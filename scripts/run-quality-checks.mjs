import { spawnSync } from "node:child_process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const gates = ["lint", "typecheck", "test", "build"];

for (const gate of gates) {
  process.stdout.write(`\nRunning pnpm ${gate}\n`);
  const result = spawnSync(pnpmCommand, [gate], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Unable to start pnpm ${gate}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
