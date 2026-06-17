export type GoogleAnalyticsConsentOptions = {
  analytics?: boolean;
  marketing?: boolean;
  waitForUpdateMs?: number;
};

export type InitializeGoogleAnalyticsOptions = {
  measurementId?: string | null;
  enabled?: boolean;
  consent?: GoogleAnalyticsConsentOptions;
  debugMode?: boolean;
  respectDoNotTrack?: boolean;
};

export type TrackGoogleAnalyticsPageViewOptions = {
  measurementId?: string | null;
  pageTitle?: string;
  pageLocation?: string;
  pagePath?: string;
};

type GoogleAnalyticsWindow = Window & Record<string, unknown> & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  __faakoGoogleAnalyticsBootstrapped?: boolean;
  __faakoGoogleAnalyticsConsentDefaulted?: boolean;
  __faakoGoogleAnalyticsInitializedIds?: string[];
};

const SCRIPT_ID_PREFIX = "faako-google-analytics";

const getAnalyticsWindow = () => {
  if (typeof window === "undefined") return null;
  return window as unknown as GoogleAnalyticsWindow;
};

const getAnalyticsDocument = () => {
  if (typeof document === "undefined") return null;
  return document;
};

const getDisabledKey = (measurementId: string) => `ga-disable-${measurementId}`;

const toConsentValue = (allowed = false) => (allowed ? "granted" : "denied");

const getConsentPayload = (consent: GoogleAnalyticsConsentOptions = {}) => {
  const analytics = Boolean(consent.analytics);
  const marketing = Boolean(consent.marketing);
  const payload: Record<string, string | number> = {
    analytics_storage: toConsentValue(analytics),
    ad_storage: toConsentValue(marketing),
    ad_user_data: toConsentValue(marketing),
    ad_personalization: toConsentValue(marketing),
  };

  if (typeof consent.waitForUpdateMs === "number") {
    payload.wait_for_update = consent.waitForUpdateMs;
  }

  return payload;
};

const isDoNotTrackEnabled = () => {
  if (typeof navigator === "undefined") return false;
  const analyticsWindow = getAnalyticsWindow();
  const legacyNavigator = navigator as Navigator & { msDoNotTrack?: string };
  const windowDoNotTrack = String(analyticsWindow?.doNotTrack || "");
  return (
    windowDoNotTrack === "1"
    || navigator.doNotTrack === "1"
    || legacyNavigator.msDoNotTrack === "1"
  );
};

const getInitializedIds = (analyticsWindow: GoogleAnalyticsWindow) => {
  if (!Array.isArray(analyticsWindow.__faakoGoogleAnalyticsInitializedIds)) {
    analyticsWindow.__faakoGoogleAnalyticsInitializedIds = [];
  }

  return analyticsWindow.__faakoGoogleAnalyticsInitializedIds;
};

const ensureGtag = (analyticsWindow: GoogleAnalyticsWindow) => {
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];

  if (typeof analyticsWindow.gtag !== "function") {
    analyticsWindow.gtag = (...args: unknown[]) => {
      analyticsWindow.dataLayer?.push(args);
    };
  }

  return analyticsWindow.gtag;
};

const hasGoogleAnalyticsScript = (
  analyticsDocument: Document,
  scriptId: string,
  measurementId: string,
) => {
  if (analyticsDocument.getElementById(scriptId)) return true;

  const scripts = Array.from(
    analyticsDocument.querySelectorAll<HTMLScriptElement>('script[src*="googletagmanager.com/gtag/js"]'),
  );

  return scripts.some((script) => {
    try {
      const url = new URL(script.src);
      return url.searchParams.get("id") === measurementId;
    } catch {
      return script.src.includes(`id=${encodeURIComponent(measurementId)}`);
    }
  });
};

export const resolveGoogleAnalyticsMeasurementId = (...values: unknown[]) => {
  const measurementId = values
    .map((value) => String(value || "").trim())
    .find(Boolean);

  return measurementId || "";
};

export const isGoogleAnalyticsEnabledForEnvironment = (
  isProduction: boolean,
  enableInDevelopment?: string | boolean,
) => {
  return Boolean(isProduction || enableInDevelopment === true || enableInDevelopment === "true");
};

export const setGoogleAnalyticsCollectionEnabled = (
  measurementId: string | null | undefined,
  enabled: boolean,
) => {
  const analyticsWindow = getAnalyticsWindow();
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId);

  if (!analyticsWindow || !resolvedMeasurementId) return false;

  analyticsWindow[getDisabledKey(resolvedMeasurementId)] = !enabled;
  return true;
};

export const isGoogleAnalyticsCollectionEnabled = (measurementId: string | null | undefined) => {
  const analyticsWindow = getAnalyticsWindow();
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId);

  if (!analyticsWindow || !resolvedMeasurementId) return false;

  return !Boolean(analyticsWindow[getDisabledKey(resolvedMeasurementId)]);
};

export const initializeGoogleAnalytics = ({
  measurementId,
  enabled = true,
  consent = { analytics: true, marketing: false },
  debugMode = false,
  respectDoNotTrack = true,
}: InitializeGoogleAnalyticsOptions = {}) => {
  const analyticsWindow = getAnalyticsWindow();
  const analyticsDocument = getAnalyticsDocument();
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId);

  if (
    !enabled
    || !resolvedMeasurementId
    || !analyticsWindow
    || !analyticsDocument
    || (respectDoNotTrack && isDoNotTrackEnabled())
  ) {
    return false;
  }

  setGoogleAnalyticsCollectionEnabled(resolvedMeasurementId, true);
  const gtag = ensureGtag(analyticsWindow);
  const initializedIds = getInitializedIds(analyticsWindow);
  const scriptId = `${SCRIPT_ID_PREFIX}-${resolvedMeasurementId.replace(/[^a-z0-9_-]/gi, "-")}`;

  if (!analyticsWindow.__faakoGoogleAnalyticsBootstrapped) {
    const consentCommand = analyticsWindow.__faakoGoogleAnalyticsConsentDefaulted ? "update" : "default";
    gtag("consent", consentCommand, getConsentPayload(consent));
    gtag("js", new Date());
    analyticsWindow.__faakoGoogleAnalyticsBootstrapped = true;
  }

  if (!hasGoogleAnalyticsScript(analyticsDocument, scriptId, resolvedMeasurementId)) {
    const script = analyticsDocument.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(resolvedMeasurementId)}`;
    analyticsDocument.head.appendChild(script);
  }

  if (!initializedIds.includes(resolvedMeasurementId)) {
    gtag("config", resolvedMeasurementId, {
      send_page_view: false,
      ...(debugMode ? { debug_mode: true } : {}),
    });
    initializedIds.push(resolvedMeasurementId);
  }

  return true;
};

export const setGoogleAnalyticsConsent = (
  measurementId: string | null | undefined,
  consent: GoogleAnalyticsConsentOptions,
) => {
  const analyticsWindow = getAnalyticsWindow();
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId);

  if (!analyticsWindow || !resolvedMeasurementId) return false;

  setGoogleAnalyticsCollectionEnabled(resolvedMeasurementId, Boolean(consent.analytics));

  if (typeof analyticsWindow.gtag !== "function") return false;

  analyticsWindow.gtag("consent", "update", getConsentPayload(consent));
  return true;
};

export const trackGoogleAnalyticsPageView = ({
  measurementId,
  pageTitle,
  pageLocation,
  pagePath,
}: TrackGoogleAnalyticsPageViewOptions = {}) => {
  const analyticsWindow = getAnalyticsWindow();
  const analyticsDocument = getAnalyticsDocument();
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId);

  if (
    !analyticsWindow
    || !analyticsDocument
    || !resolvedMeasurementId
    || !isGoogleAnalyticsCollectionEnabled(resolvedMeasurementId)
    || typeof analyticsWindow.gtag !== "function"
    || !getInitializedIds(analyticsWindow).includes(resolvedMeasurementId)
  ) {
    return false;
  }

  analyticsWindow.gtag("event", "page_view", {
    send_to: resolvedMeasurementId,
    page_title: pageTitle || analyticsDocument.title,
    page_location: pageLocation || analyticsWindow.location.href,
    page_path:
      pagePath
      || `${analyticsWindow.location.pathname}${analyticsWindow.location.search}${analyticsWindow.location.hash}`,
  });

  return true;
};
