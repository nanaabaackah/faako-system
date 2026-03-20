import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const [, , envFileArg, separator, ...commandArgs] = process.argv;

if (!envFileArg || separator !== "--" || commandArgs.length === 0) {
  console.error("Usage: node scripts/run-with-env-file.mjs <env-file> -- <command> [args...]");
  process.exit(1);
}

const envFilePath = resolve(process.cwd(), envFileArg);
const childEnv = { ...process.env };

if (existsSync(envFilePath)) {
  const fileContents = readFileSync(envFilePath, "utf8");

  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    childEnv[key] = value;
  }
}

const child = spawn(commandArgs[0], commandArgs.slice(1), {
  cwd: process.cwd(),
  env: childEnv,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
