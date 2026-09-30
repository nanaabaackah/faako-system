export const APP_ENVIRONMENTS = Object.freeze([
  "development",
  "staging",
  "production",
]);

const APP_ENVIRONMENT_SET = new Set(APP_ENVIRONMENTS);

const normalizeValue = (value) => String(value ?? "").trim().toLowerCase();

export const parseAppEnvironment = (value) => {
  const normalized = normalizeValue(value);
  if (!APP_ENVIRONMENT_SET.has(normalized)) {
    throw new Error(
      `Invalid APP_ENV "${normalized || "(empty)"}". Expected one of: ${APP_ENVIRONMENTS.join(", ")}.`
    );
  }
  return normalized;
};

export const resolveAppEnvironment = (
  env = {},
  { defaultEnvironment = "development", requireExplicitForProductionRuntime = true } = {}
) => {
  const configured = normalizeValue(env?.APP_ENV);
  if (configured) return parseAppEnvironment(configured);

  const nodeEnvironment = normalizeValue(env?.NODE_ENV);
  if (requireExplicitForProductionRuntime && nodeEnvironment === "production") {
    throw new Error(
      "APP_ENV is required when NODE_ENV=production. Set APP_ENV to staging or production explicitly."
    );
  }

  return parseAppEnvironment(defaultEnvironment);
};

export const isDevelopmentEnvironment = (environment) =>
  parseAppEnvironment(environment) === "development";

export const isStagingEnvironment = (environment) =>
  parseAppEnvironment(environment) === "staging";

export const isProductionEnvironment = (environment) =>
  parseAppEnvironment(environment) === "production";

export const isDeployedEnvironment = (environment) => {
  const parsed = parseAppEnvironment(environment);
  return parsed === "staging" || parsed === "production";
};
