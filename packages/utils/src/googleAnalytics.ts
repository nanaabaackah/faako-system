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
  deduplicate?: boolean;
};

export type GoogleAnalyticsDiagnostics = {
  configured: boolean;
  collectionEnabled: boolean;
  consentDefaulted: boolean;
  doNotTrack: boolean;
  initialized: boolean;
  lastAction: string;
  lastPagePath: string;
  scriptPresent: boolean;
};

type GoogleAnalyticsWindow = Window & Record<string, unknown> & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  __faakoGoogleAnalyticsBootstrapped?: boolean;
  __faakoGoogleAnalyticsConsentDefaulted?: boolean;
  __faakoGoogleAnalyticsInitializedIds?: string[];
  __faakoGoogleAnalyticsLastPagePaths?: Record<string, string>;
  __faakoGoogleAnalyticsDiagnostics?: Record<string, GoogleAnalyticsDiagnostics>;
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

const getLastPagePaths = (analyticsWindow: GoogleAnalyticsWindow) => {
  analyticsWindow.__faakoGoogleAnalyticsLastPagePaths ||= {};
  return analyticsWindow.__faakoGoogleAnalyticsLastPagePaths;
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

const updateDiagnostics = (measurementId: string, lastAction: string) => {
  const analyticsWindow = getAnalyticsWindow();
  const analyticsDocument = getAnalyticsDocument();
  if (!analyticsWindow || !measurementId) return;

  const scriptId = `${SCRIPT_ID_PREFIX}-${measurementId.replace(/[^a-z0-9_-]/gi, "-")}`;
  const initialized = Boolean(
    analyticsWindow.__faakoGoogleAnalyticsInitializedIds?.includes(measurementId)
  );
  analyticsWindow.__faakoGoogleAnalyticsDiagnostics ||= {};
  analyticsWindow.__faakoGoogleAnalyticsDiagnostics[measurementId] = {
    configured: true,
    collectionEnabled: initialized && analyticsWindow[getDisabledKey(measurementId)] === false,
    consentDefaulted: Boolean(analyticsWindow.__faakoGoogleAnalyticsConsentDefaulted),
    doNotTrack: isDoNotTrackEnabled(),
    initialized,
    lastAction,
    lastPagePath: analyticsWindow.__faakoGoogleAnalyticsLastPagePaths?.[measurementId] || "",
    scriptPresent: Boolean(
      analyticsDocument
      && hasGoogleAnalyticsScript(analyticsDocument, scriptId, measurementId)
    ),
  };
};

export const resolveGoogleAnalyticsMeasurementId = (...values: unknown[]) => {
  const measurementId = values
    .map((value) => String(value || "").trim())
    .find(Boolean);

  return measurementId || "";
};

export const getGoogleAnalyticsDiagnostics = (
  measurementId: string | null | undefined,
): GoogleAnalyticsDiagnostics => {
  const analyticsWindow = getAnalyticsWindow();
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId);
  const empty: GoogleAnalyticsDiagnostics = {
    configured: Boolean(resolvedMeasurementId),
    collectionEnabled: false,
    consentDefaulted: false,
    doNotTrack: isDoNotTrackEnabled(),
    initialized: false,
    lastAction: resolvedMeasurementId ? "not-initialized" : "missing-measurement-id",
    lastPagePath: "",
    scriptPresent: false,
  };

  if (!analyticsWindow || !resolvedMeasurementId) return empty;
  updateDiagnostics(resolvedMeasurementId, analyticsWindow.__faakoGoogleAnalyticsDiagnostics?.[resolvedMeasurementId]?.lastAction || "not-initialized");
  return analyticsWindow.__faakoGoogleAnalyticsDiagnostics?.[resolvedMeasurementId] || empty;
};

export const clearGoogleAnalyticsCookies = () => {
  const analyticsWindow = getAnalyticsWindow();
  const analyticsDocument = getAnalyticsDocument();
  if (!analyticsWindow || !analyticsDocument) return 0;

  const names = String(analyticsDocument.cookie || "")
    .split(";")
    .map((entry) => entry.split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name && /^_ga(?:_|$)/.test(name)));
  const hostname = analyticsWindow.location.hostname;
  const domains = ["", hostname, hostname ? `.${hostname}` : ""];

  names.forEach((name) => {
    domains.forEach((domain) => {
      analyticsDocument.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
    });
  });

  return names.length;
};

export const isGoogleAnalyticsEnabledForEnvironment = (
  isProduction: boolean,
  enableInDevelopment?: string | boolean,
) => {
  return Boolean(isProduction || enableInDevelopment === true || enableInDevelopment === "true");
};

export const sanitizeAnalyticsPageLocation = (
  value: string,
  fallbackOrigin = "https://analytics.invalid",
) => {
  try {
    const url = new URL(value || "/", fallbackOrigin);
    return {
      location: `${url.origin}${url.pathname}`,
      path: url.pathname || "/",
    };
  } catch {
    return { location: fallbackOrigin, path: "/" };
  }
};

export const setGoogleAnalyticsCollectionEnabled = (
  measurementId: string | null | undefined,
  enabled: boolean,
) => {
  const analyticsWindow = getAnalyticsWindow();
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId);

  if (!analyticsWindow || !resolvedMeasurementId) return false;

  analyticsWindow[getDisabledKey(resolvedMeasurementId)] = !enabled;
  updateDiagnostics(resolvedMeasurementId, enabled ? "collection-enabled" : "collection-disabled");
  return true;
};

export const isGoogleAnalyticsCollectionEnabled = (measurementId: string | null | undefined) => {
  const analyticsWindow = getAnalyticsWindow();
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId);

  if (!analyticsWindow || !resolvedMeasurementId) return false;

  return analyticsWindow[getDisabledKey(resolvedMeasurementId)] === false;
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
  ) {
    return false;
  }

  if (respectDoNotTrack && isDoNotTrackEnabled()) {
    setGoogleAnalyticsConsent(resolvedMeasurementId, { analytics: false, marketing: false });
    updateDiagnostics(resolvedMeasurementId, "blocked-by-do-not-track");
    return false;
  }

  if (!consent.analytics) {
    setGoogleAnalyticsConsent(resolvedMeasurementId, {
      ...consent,
      analytics: false,
    });
    return false;
  }

  setGoogleAnalyticsCollectionEnabled(resolvedMeasurementId, true);
  const gtag = ensureGtag(analyticsWindow);
  const initializedIds = getInitializedIds(analyticsWindow);
  const scriptId = `${SCRIPT_ID_PREFIX}-${resolvedMeasurementId.replace(/[^a-z0-9_-]/gi, "-")}`;
  const consentPayload = getConsentPayload(consent);

  if (!analyticsWindow.__faakoGoogleAnalyticsBootstrapped) {
    const consentCommand = analyticsWindow.__faakoGoogleAnalyticsConsentDefaulted ? "update" : "default";
    gtag("consent", consentCommand, consentPayload);
    analyticsWindow.__faakoGoogleAnalyticsConsentDefaulted = true;
    gtag("js", new Date());
    analyticsWindow.__faakoGoogleAnalyticsBootstrapped = true;
  } else {
    gtag("consent", "update", consentPayload);
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

  updateDiagnostics(resolvedMeasurementId, "initialized");

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

  if (!consent.analytics) {
    clearGoogleAnalyticsCookies();
    delete getLastPagePaths(analyticsWindow)[resolvedMeasurementId];
  }

  if (typeof analyticsWindow.gtag !== "function") {
    updateDiagnostics(resolvedMeasurementId, consent.analytics ? "consent-granted-pending-initialization" : "consent-denied");
    return true;
  }

  analyticsWindow.gtag("consent", "update", getConsentPayload(consent));
  updateDiagnostics(resolvedMeasurementId, consent.analytics ? "consent-granted" : "consent-denied");
  return true;
};

export const trackGoogleAnalyticsPageView = ({
  measurementId,
  pageTitle,
  pageLocation,
  pagePath,
  deduplicate = true,
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

  const safePage = sanitizeAnalyticsPageLocation(
    pageLocation || analyticsWindow.location.href,
    analyticsWindow.location.origin,
  );
  const safePath = sanitizeAnalyticsPageLocation(
    pagePath || safePage.path,
    analyticsWindow.location.origin,
  ).path;
  const lastPagePaths = getLastPagePaths(analyticsWindow);

  if (deduplicate && lastPagePaths[resolvedMeasurementId] === safePath) {
    updateDiagnostics(resolvedMeasurementId, "duplicate-page-view-blocked");
    return false;
  }

  analyticsWindow.gtag("event", "page_view", {
    send_to: resolvedMeasurementId,
    page_title: pageTitle || analyticsDocument.title,
    // Query strings and fragments commonly contain form, reset, search, or
    // campaign values. The shared boundary deliberately sends route paths only.
    page_location: safePage.location,
    page_path: safePath,
  });
  lastPagePaths[resolvedMeasurementId] = safePath;
  updateDiagnostics(resolvedMeasurementId, "page-view-sent");

  return true;
};
