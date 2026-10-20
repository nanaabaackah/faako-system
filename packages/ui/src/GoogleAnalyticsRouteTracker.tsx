import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  initializeGoogleAnalytics,
  resolveGoogleAnalyticsMeasurementId,
  setGoogleAnalyticsConsent,
  trackGoogleAnalyticsPageView,
  type GoogleAnalyticsConsentOptions,
} from "@faako/utils";

export type GoogleAnalyticsRouteTrackerProps = {
  measurementId?: string | null;
  enabled?: boolean;
  consent?: GoogleAnalyticsConsentOptions;
  debugMode?: boolean;
  shouldTrack?: () => boolean;
};

export const GoogleAnalyticsRouteTracker = ({
  measurementId,
  enabled = true,
  consent,
  debugMode = false,
  shouldTrack,
}: GoogleAnalyticsRouteTrackerProps) => {
  const location = useLocation();
  const resolvedMeasurementId = resolveGoogleAnalyticsMeasurementId(measurementId);
  const trackingAllowed = Boolean(
    enabled
    && resolvedMeasurementId
    && (!shouldTrack || shouldTrack())
  );
  const analyticsConsent = consent?.analytics ?? true;
  const marketingConsent = consent?.marketing ?? false;
  const consentWaitMs = consent?.waitForUpdateMs;
  useEffect(() => {
    if (!trackingAllowed || !analyticsConsent) {
      setGoogleAnalyticsConsent(resolvedMeasurementId, {
        analytics: false,
        marketing: false,
      });
      return;
    }

    const initialized = initializeGoogleAnalytics({
      measurementId: resolvedMeasurementId,
      enabled: true,
      consent: {
        analytics: analyticsConsent,
        marketing: marketingConsent,
        waitForUpdateMs: consentWaitMs,
      },
      debugMode,
    });
    if (!initialized) return;

    trackGoogleAnalyticsPageView({
      measurementId: resolvedMeasurementId,
      pagePath: `${location.pathname}${location.search}${location.hash}`,
    });
  }, [
    analyticsConsent,
    consentWaitMs,
    debugMode,
    location.hash,
    location.pathname,
    location.search,
    marketingConsent,
    resolvedMeasurementId,
    trackingAllowed,
  ]);

  return null;
};
