export const APP_MODES = Object.freeze({
  NORMAL: "normal",
  DEGRADED: "degraded",
  READ_ONLY: "read_only",
  MAINTENANCE: "maintenance",
});

export const APP_MODE_VALUES = Object.freeze(Object.values(APP_MODES));

const truthyValues = new Set(["1", "true", "yes", "on", "enabled"]);

const parseBooleanFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;
  return truthyValues.has(value.trim().toLowerCase());
};

export const normalizeAppMode = (mode) => {
  const normalized = String(mode || "").trim().toLowerCase().replace(/-/g, "_");
  return APP_MODE_VALUES.includes(normalized) ? normalized : APP_MODES.NORMAL;
};

export const resolveAppModeFromEnv = (env = {}) => {
  const explicitMode = normalizeAppMode(env.VITE_APP_MODE || env.APP_MODE);
  if (explicitMode !== APP_MODES.NORMAL) return explicitMode;
  if (parseBooleanFlag(env.VITE_MAINTENANCE_MODE || env.MAINTENANCE_MODE)) {
    return APP_MODES.MAINTENANCE;
  }
  if (parseBooleanFlag(env.VITE_READ_ONLY_MODE || env.READ_ONLY_MODE)) {
    return APP_MODES.READ_ONLY;
  }
  if (parseBooleanFlag(env.VITE_DEGRADED_MODE || env.DEGRADED_MODE)) {
    return APP_MODES.DEGRADED;
  }
  return APP_MODES.NORMAL;
};

export const getAppModeFlags = (mode) => {
  const normalized = normalizeAppMode(mode);
  return {
    mode: normalized,
    isNormal: normalized === APP_MODES.NORMAL,
    isDegraded: normalized === APP_MODES.DEGRADED,
    isReadOnly: normalized === APP_MODES.READ_ONLY,
    isMaintenance: normalized === APP_MODES.MAINTENANCE,
    shouldShowBanner: normalized !== APP_MODES.NORMAL,
    isWriteRestricted: normalized === APP_MODES.READ_ONLY || normalized === APP_MODES.MAINTENANCE,
  };
};

export const getAppModeTone = (mode) => {
  const normalized = normalizeAppMode(mode);
  if (normalized === APP_MODES.DEGRADED) return "degraded";
  if (normalized === APP_MODES.READ_ONLY) return "maintenance";
  if (normalized === APP_MODES.MAINTENANCE) return "maintenance";
  return "success";
};

export const getAppModeNotice = (mode) => {
  const normalized = normalizeAppMode(mode);
  if (normalized === APP_MODES.DEGRADED) {
    return {
      mode: normalized,
      tone: "degraded",
      title: "Limited service",
      message: "Some services may be slower or unavailable. You can continue using the app unless a workflow tells you otherwise.",
    };
  }
  if (normalized === APP_MODES.READ_ONLY) {
    return {
      mode: normalized,
      tone: "maintenance",
      title: "Read-only mode",
      message: "Viewing is available, but data entry should be avoided until normal service resumes.",
    };
  }
  if (normalized === APP_MODES.MAINTENANCE) {
    return {
      mode: normalized,
      tone: "maintenance",
      title: "Maintenance mode",
      message: "This app is temporarily limited while maintenance is in progress.",
    };
  }
  return {
    mode: APP_MODES.NORMAL,
    tone: "success",
    title: "Normal service",
    message: "The app is operating normally.",
  };
};

export const isAppModeWriteRestricted = (mode) => getAppModeFlags(mode).isWriteRestricted;

export const shouldShowAppModeBanner = (mode) => getAppModeFlags(mode).shouldShowBanner;
