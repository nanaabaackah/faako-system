const STORAGE_PREFIX = "reebs_admin_preferences";

export const ADMIN_PREFERENCES_CHANGE_EVENT = "reebs-admin-preferences-change";

export const DEFAULT_ADMIN_PREFERENCES = Object.freeze({
  theme: "system",
  fontSize: "default",
});

export const ADMIN_THEME_OPTIONS = Object.freeze([
  { value: "system", label: "Device Settings" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]);

export const ADMIN_FONT_SIZE_OPTIONS = Object.freeze([
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
]);

const ROOT_FONT_SIZE_MAP = Object.freeze({
  compact: "15px",
  default: "16px",
  large: "18px",
});

const normalizeUserId = (userId) => {
  const normalized = String(userId ?? "guest").trim();
  return normalized || "guest";
};

const normalizeTheme = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ADMIN_THEME_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : DEFAULT_ADMIN_PREFERENCES.theme;
};

const normalizeFontSize = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ROOT_FONT_SIZE_MAP, normalized)
    ? normalized
    : DEFAULT_ADMIN_PREFERENCES.fontSize;
};

export const sanitizeAdminPreferences = (value) => ({
  theme: normalizeTheme(value?.theme),
  fontSize: normalizeFontSize(value?.fontSize),
});

export const getAdminPreferencesStorageKey = (userId) =>
  `${STORAGE_PREFIX}_${normalizeUserId(userId)}`;

export const readAdminPreferences = (userId) => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_ADMIN_PREFERENCES };
  }

  try {
    const raw = window.localStorage.getItem(getAdminPreferencesStorageKey(userId));
    if (!raw) return { ...DEFAULT_ADMIN_PREFERENCES };
    return sanitizeAdminPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_ADMIN_PREFERENCES };
  }
};

export const resolveAdminTheme = (theme, mediaQuery) => {
  const normalizedTheme = normalizeTheme(theme);
  if (normalizedTheme !== "system") return normalizedTheme;
  return mediaQuery?.matches ? "dark" : "light";
};

export const applyAdminPreferences = (preferences, options = {}) => {
  const root = options.root || (typeof document !== "undefined" ? document.documentElement : null);
  const nextPreferences = sanitizeAdminPreferences(preferences);
  if (!root) return nextPreferences;

  const resolvedTheme = resolveAdminTheme(nextPreferences.theme, options.mediaQuery);
  root.setAttribute("data-admin-theme", resolvedTheme);
  root.setAttribute("data-admin-font-size", nextPreferences.fontSize);
  root.style.fontSize = ROOT_FONT_SIZE_MAP[nextPreferences.fontSize];

  return nextPreferences;
};

export const clearAppliedAdminPreferences = (
  root = typeof document !== "undefined" ? document.documentElement : null,
) => {
  if (!root) return;
  root.removeAttribute("data-admin-theme");
  root.removeAttribute("data-admin-font-size");
  root.style.removeProperty("font-size");
};

export const writeAdminPreferences = (userId, preferences) => {
  const nextPreferences = sanitizeAdminPreferences(preferences);
  const normalizedUserId = normalizeUserId(userId);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        getAdminPreferencesStorageKey(normalizedUserId),
        JSON.stringify(nextPreferences),
      );
    } catch (error) {
      console.warn("Failed to store admin preferences", error);
    }

    if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
      window.dispatchEvent(
        new CustomEvent(ADMIN_PREFERENCES_CHANGE_EVENT, {
          detail: {
            userId: normalizedUserId,
            preferences: nextPreferences,
          },
        }),
      );
    }
  }

  return nextPreferences;
};
