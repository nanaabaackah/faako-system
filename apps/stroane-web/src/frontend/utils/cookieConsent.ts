export type StroaneCookiePreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export const STROANE_COOKIE_PREFS_KEY = "stroane_cookie_preferences_v1";
export const STROANE_COOKIE_PREFS_EVENT = "stroane-cookie-preferences";
export const STROANE_COOKIE_PREFS_OPEN_EVENT = "stroane-cookie-preferences-open";

export const readStroaneCookiePreferences = (): StroaneCookiePreferences | null => {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(STROANE_COOKIE_PREFS_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (
      parsed?.necessary !== true
      || typeof parsed.analytics !== "boolean"
      || typeof parsed.marketing !== "boolean"
    ) return null;

    return {
      necessary: true,
      analytics: Boolean(parsed?.analytics),
      marketing: Boolean(parsed?.marketing),
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
};

export const hasStroaneAnalyticsConsent = () => Boolean(readStroaneCookiePreferences()?.analytics);

export const openStroaneCookiePreferences = () => {
  window.dispatchEvent(new CustomEvent(STROANE_COOKIE_PREFS_OPEN_EVENT));
};

export const writeStroaneCookiePreferences = (
  preferences: Omit<StroaneCookiePreferences, "updatedAt">,
) => {
  if (typeof window === "undefined") return null;

  const nextPreferences: StroaneCookiePreferences = {
    necessary: true,
    analytics: Boolean(preferences.analytics),
    marketing: Boolean(preferences.marketing),
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(STROANE_COOKIE_PREFS_KEY, JSON.stringify(nextPreferences));
  window.dispatchEvent(
    new CustomEvent<StroaneCookiePreferences>(STROANE_COOKIE_PREFS_EVENT, {
      detail: nextPreferences,
    }),
  );

  return nextPreferences;
};
