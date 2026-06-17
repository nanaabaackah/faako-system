import {
  DEFAULT_DEMO_SCENARIO_ID,
  normalizeDemoScenarioId,
} from "../data/demoScenarios.js";

const DEMO_ACCESS_STORAGE_KEY = "faako-erp-demo-access";

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isFutureDate = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

const normalizeSession = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const email = String(value.email || "").trim().toLowerCase();
  const expiresAt = String(value.expiresAt || "").trim();

  if (!email || !isFutureDate(expiresAt)) {
    return null;
  }

  return {
    email,
    grantedAt: String(value.grantedAt || "").trim(),
    expiresAt,
    scenarioId: normalizeDemoScenarioId(value.scenarioId || DEFAULT_DEMO_SCENARIO_ID),
  };
};

export const readStoredDemoAccess = () => {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(DEMO_ACCESS_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const normalized = normalizeSession(JSON.parse(rawValue));

    if (!normalized) {
      window.localStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
    }

    return normalized;
  } catch {
    window.localStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
    return null;
  }
};

export const writeStoredDemoAccess = (session) => {
  if (!canUseStorage()) {
    return;
  }

  const normalized = normalizeSession(session);

  if (!normalized) {
    window.localStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    DEMO_ACCESS_STORAGE_KEY,
    JSON.stringify(normalized),
  );
};

export const clearStoredDemoAccess = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
};
