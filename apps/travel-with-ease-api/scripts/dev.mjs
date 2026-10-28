import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Local public preview only. Never import a hosted .env, identity or database.
// Staff routes remain unauthenticated/denied rather than receiving a fake user.
if (process.env.NODE_ENV === "production" || ["staging", "production"].includes(process.env.APP_ENV)) {
  throw new Error("The preview launcher cannot run in a hosted environment.");
}
const env = {
  PATH: process.env.PATH,
  ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
  ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
  APP_ENV: "development", NODE_ENV: "development",
  PORT: "3090", HOST: "127.0.0.1",
  ALLOWED_ORIGINS: "http://localhost:4328,http://localhost:5188,http://127.0.0.1:4328,http://127.0.0.1:5188",
};
console.info("TWE local public preview: hosted .env files are not loaded; staff sign-in is unavailable.");
const child = spawn(process.execPath, ["src/server.js"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)), env, stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("Could not start the local TWE API."); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
