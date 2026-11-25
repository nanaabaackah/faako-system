import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
export function runReviewedCommand(command, args, env, { cwd = root, timeout = 180_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", settled = false;
    const finish = (error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (error) reject(Object.assign(new Error("The reviewed build command did not complete."), { code: error })); else resolve(output.trim());
    };
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish("command_timeout"); }, timeout);
    child.stdout.on("data", chunk => { if (output.length < 100_000) output += chunk.toString().slice(0, 100_000 - output.length); });
    child.stderr.resume(); // Build output may contain private paths: never return it to clients/logs.
    child.on("error", () => finish("command_spawn_failed"));
    child.on("close", code => finish(code === 0 ? null : "command_exit_failed"));
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

// Validate hosted public build settings before the worker claims any job. A
// build with no Turnstile site key would disable the deployed enquiry form.
export function readHostedPublicBuildSettings(env = process.env) {
  const environment = env.APP_ENV;
  if (!["staging", "production"].includes(environment)) throw new Error("Hosted public build requires a staging or production environment.");
  const apiOrigin = env.TWE_PUBLIC_API_ORIGIN;
  let url;
  try { url = new URL(apiOrigin); } catch { throw new Error("TWE_PUBLIC_API_ORIGIN must be an exact HTTPS origin."); }
  if (url.protocol !== "https:" || url.origin !== apiOrigin || url.username || url.password) throw new Error("TWE_PUBLIC_API_ORIGIN must be an exact HTTPS origin.");
  const turnstileSiteKey = env.TWE_PUBLIC_TURNSTILE_SITE_KEY;
  if (typeof turnstileSiteKey !== "string" || !/^[A-Za-z0-9_-]{10,150}$/.test(turnstileSiteKey) || /^[123]x0{10,}/.test(turnstileSiteKey)) throw new Error("TWE_PUBLIC_TURNSTILE_SITE_KEY must contain a real hosted site key.");
  return { apiOrigin, turnstileSiteKey, indexable: environment === "production" && env.TWE_PUBLIC_SITE_INDEXABLE === "true", googleVerification: env.TWE_PUBLIC_GOOGLE_SITE_VERIFICATION || "" };
}
