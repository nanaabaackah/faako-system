import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
export function runReviewedCommand(command, args, env, { cwd = root, timeout = 180_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", settled = false;
    const finish = (error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) reject(new Error("The reviewed build command did not complete.")); else resolve(output.trim());
    };
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(true); }, timeout);
    child.stdout.on("data", chunk => { if (output.length < 100_000) output += chunk.toString().slice(0, 100_000 - output.length); });
    child.stderr.resume(); // Build output may contain private paths: never return it to clients/logs.
    child.on("error", () => finish(true));
    child.on("close", code => finish(code !== 0));
  });
}

export function publicBuildEnvironment({ environment, snapshot, publicDirectory, out, siteOrigin, apiOrigin, turnstileSiteKey = "", indexable = false, sourceSha = "", googleVerification = "" }) {
  // An allowlist, not {...process.env}. No DB, Access, Resend or provider secrets
  // enter the public build process or import.meta.env.
  return {
    PATH: process.env.PATH, ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
    NODE_ENV: "production", ASTRO_TELEMETRY_DISABLED: "1",
    PUBLIC_APP_ENV: environment, PUBLIC_SITE_URL: siteOrigin,
    PUBLIC_API_BASE_URL: apiOrigin, PUBLIC_TURNSTILE_SITE_KEY: turnstileSiteKey,
    PUBLIC_SITE_INDEXABLE: String(indexable),
    TWE_RELEASE_SHA: sourceSha, PUBLIC_GOOGLE_SITE_VERIFICATION: googleVerification,
    TWE_CONTENT_SNAPSHOT: snapshot, TWE_BUILD_PUBLIC_DIR: publicDirectory,
    TWE_BUILD_OUT_DIR: out,
  };
}
