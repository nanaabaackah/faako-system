import { spawnSync } from "node:child_process";

const tools = [
  { command: "node", args: ["--version"], supported: /^v(?:2[024]|[3-9]\d)\./, guidance: "Install Node.js 20, 22, or 24." },
  { command: "pnpm", args: ["--version"], supported: /^10\./, guidance: "Enable Corepack and install the pnpm version declared in package.json." },
  { command: "rg", args: ["--version"], supported: /^ripgrep\s+\d+/i, guidance: "Install ripgrep before running security checks." },
];

const failures = [];
for (const tool of tools) {
  const result = spawnSync(tool.command, tool.args, { encoding: "utf8" });
  const version = String(result.stdout || result.stderr || "").trim().split(/\r?\n/)[0];
  if (result.error?.code === "ENOENT") {
    failures.push(`${tool.command}: command not found. ${tool.guidance}`);
    continue;
  }
  if (result.status !== 0) {
    failures.push(`${tool.command}: version command failed. ${tool.guidance}`);
    continue;
  }
  if (!tool.supported.test(version)) {
    failures.push(`${tool.command}: unsupported version ${version || "unknown"}. ${tool.guidance}`);
  }
}

if (failures.length) {
  console.error("Tooling prerequisite check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Tooling prerequisite check passed. node, pnpm, and rg are available at supported versions.");
