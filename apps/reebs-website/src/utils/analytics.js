import {
  initializeGoogleAnalytics,
  isGoogleAnalyticsEnabledForEnvironment,
  resolveGoogleAnalyticsMeasurementId,
  setGoogleAnalyticsConsent,
  trackGoogleAnalyticsPageView,
} from "@faako/utils";

export const REEBS_ANALYTICS_PREFS_STORAGE_KEY = "reebsCookiePrefs";
export const REEBS_COOKIE_PREFS_OPEN_EVENT = "reebs-cookie-preferences-open";
export const GOOGLE_ANALYTICS_MEASUREMENT_ID = resolveGoogleAnalyticsMeasurementId(
  import.meta.env.VITE_GA_MEASUREMENT_ID,
  import.meta.env.VITE_GA_ID,
);
export const GOOGLE_ANALYTICS_ENABLED = isGoogleAnalyticsEnabledForEnvironment(
  import.meta.env.PROD,
  import.meta.env.VITE_ENABLE_GA_IN_DEV,
);

export const readReebsAnalyticsPrefs = () => {
  if (typeof localStorage === "undefined") return null;

  try {
    const savedPrefs = localStorage.getItem(REEBS_ANALYTICS_PREFS_STORAGE_KEY);
    if (!savedPrefs) return null;
    const parsed = JSON.parse(savedPrefs);
    if (
      parsed?.necessary !== true
      || typeof parsed.analytics !== "boolean"
      || typeof parsed.marketing !== "boolean"
    ) return null;
    return {
      necessary: true,
      analytics: Boolean(parsed?.analytics),
      marketing: Boolean(parsed?.marketing),
    };
  } catch (error) {
    console.warn("Unable to read analytics preferences", error);
    return null;
  }
};

export const openReebsCookiePreferences = () => {
  window.dispatchEvent(new CustomEvent(REEBS_COOKIE_PREFS_OPEN_EVENT));
};

export const hasReebsAnalyticsConsent = () => Boolean(readReebsAnalyticsPrefs()?.analytics);

export const initializeReebsGoogleAnalytics = () => {
  const prefs = readReebsAnalyticsPrefs();

  return initializeGoogleAnalytics({
    measurementId: GOOGLE_ANALYTICS_MEASUREMENT_ID,
    enabled: GOOGLE_ANALYTICS_ENABLED && Boolean(prefs?.analytics),
    consent: {
      analytics: Boolean(prefs?.analytics),
      marketing: Boolean(prefs?.marketing),
    },
  });
};

export const updateReebsGoogleAnalyticsConsent = (prefs) => {
  const consent = {
    analytics: Boolean(prefs?.analytics),
    marketing: Boolean(prefs?.marketing),
  };

  setGoogleAnalyticsConsent(GOOGLE_ANALYTICS_MEASUREMENT_ID, consent);

  if (!GOOGLE_ANALYTICS_ENABLED || !consent.analytics) {
    return false;
  }

  const initialized = initializeGoogleAnalytics({
    measurementId: GOOGLE_ANALYTICS_MEASUREMENT_ID,
    enabled: true,
    consent,
  });

  if (initialized) {
    trackGoogleAnalyticsPageView({ measurementId: GOOGLE_ANALYTICS_MEASUREMENT_ID });
  }

  return initialized;
};
