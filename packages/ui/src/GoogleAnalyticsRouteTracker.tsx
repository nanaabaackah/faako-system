import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  initializeGoogleAnalytics,
  resolveGoogleAnalyticsMeasurementId,
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

  useEffect(() => {
    if (!trackingAllowed) return;

    initializeGoogleAnalytics({
      measurementId: resolvedMeasurementId,
      enabled: true,
      consent,
      debugMode,
    });
  }, [consent, debugMode, resolvedMeasurementId, trackingAllowed]);

  useEffect(() => {
    if (!trackingAllowed) return;

    trackGoogleAnalyticsPageView({
      measurementId: resolvedMeasurementId,
      pagePath: `${location.pathname}${location.search}${location.hash}`,
    });
  }, [
    location.hash,
    location.pathname,
    location.search,
    resolvedMeasurementId,
    trackingAllowed,
  ]);

  return null;
};
