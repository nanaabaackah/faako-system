export const FAAKO_COOKIE_PREFS_KEY = "faako_cookie_preferences_v1";
export const FAAKO_COOKIE_PREFS_EVENT = "faako-cookie-preferences";

export const readFaakoCookiePreferences = () => {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(FAAKO_COOKIE_PREFS_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      necessary: true,
      analytics: Boolean(parsed?.analytics),
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
};

export const hasFaakoAnalyticsConsent = () => Boolean(readFaakoCookiePreferences()?.analytics);

export const saveFaakoCookiePreferences = ({ analytics }) => {
  const preferences = {
    necessary: true,
    analytics: Boolean(analytics),
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(FAAKO_COOKIE_PREFS_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent(FAAKO_COOKIE_PREFS_EVENT, { detail: preferences }));
};
