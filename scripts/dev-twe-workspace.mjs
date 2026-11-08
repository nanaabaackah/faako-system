import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

if (
  process.env.NODE_ENV === "production" ||
  ["staging", "production"].includes(process.env.APP_ENV) ||
  process.env.RAILWAY_ENVIRONMENT_ID ||
  process.env.CF_PAGES
) {
  throw new Error("The workspace launcher is local-only.");
}
// Do not forward hosted credentials or load .env files into the fixture server.
const env = {
  PATH: process.env.PATH,
  ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
  ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
  APP_ENV: "development",
  NODE_ENV: "development",
  TWE_WORKSPACE_PREVIEW: "true",
  VITE_TWE_LOCAL_WORKSPACE: "true",
  ASTRO_TELEMETRY_DISABLED: "1",
  PUBLIC_APP_ENV: "development",
  PUBLIC_SITE_URL: "http://127.0.0.1:4328",
  TWE_API_PROXY_TARGET: "http://127.0.0.1:3090",
};
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* Child already exited. */
    }
  }
}
function start(args, command = process.execPath) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    detached: true,
  });
  children.push(child);
  child.on("error", () => stop(1));
  child.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => stop());
process.on("exit", () => stop());
console.info(
  "Local workspace preview: Owner by default; change roles/reset in the preview toolbar. Nothing is sent or published.",
);
start(["apps/travel-with-ease-portal/dev/serve-workspace.mjs"]);
const pnpm = process.env.npm_execpath;
if (!pnpm)
  throw new Error("Run this command through pnpm run dev:twe:workspace.");
const runPnpm = (args) =>
  /\.[cm]?js$/.test(pnpm) ? start([pnpm, ...args]) : start(args, pnpm);
runPnpm(["--filter", "@faako/travel-with-ease-portal", "dev"]);
runPnpm([
  "--filter",
  "@faako/travel-with-ease-web",
  "exec",
  "astro",
  "dev",
  "--host",
  "127.0.0.1",
  "--port",
  "4328",
]);
