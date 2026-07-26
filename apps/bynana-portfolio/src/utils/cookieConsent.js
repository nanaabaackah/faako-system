export const BYNANA_COOKIE_PREFS_KEY = 'bynana_cookie_preferences_v1';
export const BYNANA_COOKIE_PREFS_EVENT = 'bynana-cookie-preferences';
export const BYNANA_COOKIE_PREFS_OPEN_EVENT = 'bynana-cookie-preferences-open';

export const readByNanaCookiePreferences = () => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(BYNANA_COOKIE_PREFS_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      necessary: true,
      analytics: Boolean(parsed?.analytics),
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return null;
  }
};

export const hasByNanaAnalyticsConsent = () => Boolean(readByNanaCookiePreferences()?.analytics);

export const saveByNanaCookiePreferences = ({ analytics }) => {
  const preferences = {
    necessary: true,
    analytics: Boolean(analytics),
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(BYNANA_COOKIE_PREFS_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent(BYNANA_COOKIE_PREFS_EVENT, { detail: preferences }));
};

export const openByNanaCookiePreferences = () => {
  window.dispatchEvent(new CustomEvent(BYNANA_COOKIE_PREFS_OPEN_EVENT));
};
