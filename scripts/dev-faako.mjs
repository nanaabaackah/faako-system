import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

const tasks = [
  {
    name: "faako-api",
    color: "\u001b[35m",
    args: ["--filter", "@faako/faako-api", "run", "dev:backend"],
  },
  {
    name: "faako-website",
    color: "\u001b[36m",
    args: ["--filter", "@faako/faako-website", "run", "dev:frontend"],
  },
  {
    name: "faako-erp",
    color: "\u001b[34m",
    args: ["--filter", "@faako/faako-erp", "run", "dev:frontend"],
  },
];

const resetColor = "\u001b[0m";
const children = new Map();
let shuttingDown = false;

const prefixLine = (task, line, stream) => {
  if (!line) {
    return;
  }

  stream.write(`${task.color}[${task.name}]${resetColor} ${line}\n`);
};

const wireStream = (task, stream, writer) => {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      prefixLine(task, line, writer);
    }
  });

  stream.on("end", () => {
    if (buffer) {
      prefixLine(task, buffer, writer);
    }
  });
};

const stopChildren = (signal = "SIGTERM") => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children.values()) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

for (const task of tasks) {
  const child = spawn("pnpm", task.args, {
    cwd: resolve(rootDir, ".."),
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.set(task.name, child);
  wireStream(task, child.stdout, process.stdout);
  wireStream(task, child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    children.delete(task.name);

    if (!shuttingDown && (code || signal)) {
      stopChildren();
      process.exitCode = code || 1;
    } else if (!children.size) {
      process.exitCode = process.exitCode || 0;
    }
  });

  child.on("error", (error) => {
    prefixLine(task, error.message, process.stderr);
    stopChildren();
    process.exitCode = 1;
  });
}

process.on("SIGINT", () => {
  stopChildren("SIGINT");
});

process.on("SIGTERM", () => {
  stopChildren("SIGTERM");
});
