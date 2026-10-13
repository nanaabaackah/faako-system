const environments = new Set(["development", "test", "staging", "production"]);

export function validateEnvironment(environment, nodeEnvironment) {
  if (!environments.has(environment)) throw new Error("APP_ENV must be development, test, staging or production.");
  if (nodeEnvironment === "production" && ["development", "test"].includes(environment)) {
    throw new Error("A production runtime cannot enable development or test adapters.");
  }
  return environment;
}

export function readConfig(env = process.env) {
  const environment = validateEnvironment(env.APP_ENV || env.NODE_ENV || "development", env.NODE_ENV);
  const deployed = ["staging", "production"].includes(environment);
  const port = Number(env.PORT || 3090);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535.");
  const allowedOrigins = String(env.ALLOWED_ORIGINS ?? (deployed ? "" : "http://localhost:4328,http://localhost:5188"))
    .split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!allowedOrigins.length) throw new Error("ALLOWED_ORIGINS must contain explicit origins.");
  for (const origin of allowedOrigins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error("ALLOWED_ORIGINS contains an invalid origin."); }
    if (url.origin !== origin || !["http:", "https:"].includes(url.protocol) || (deployed && url.protocol !== "https:")) {
      throw new Error("ALLOWED_ORIGINS must contain exact HTTP origins; deployed origins require HTTPS.");
    }
  }
  return Object.freeze({ environment, deployed, port, allowedOrigins });
}

// Keep this guard shared by the executable and factory: credentials alone are
// not evidence that reviewed persistence and staff-session adapters exist.
export function assertLocalFoundation(environment) {
  validateEnvironment(environment);
  if (!["development", "test"].includes(environment)) {
    throw new Error("Deployed startup is disabled until PostgreSQL and staff-session integration are verified.");
  }
}
