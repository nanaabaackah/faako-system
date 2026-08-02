import { useEffect } from "react";
import {
  GOOGLE_ANALYTICS_ENABLED,
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  hasReebsAnalyticsConsent,
  initializeReebsGoogleAnalytics,
} from "../../utils/analytics.js";
import { trackGoogleAnalyticsPageView } from "@faako/utils";

export default function AnalyticsIsland({ path = "/" }) {
  useEffect(() => {
    if (!GOOGLE_ANALYTICS_ENABLED || !hasReebsAnalyticsConsent()) return;
    if (!initializeReebsGoogleAnalytics()) return;
    trackGoogleAnalyticsPageView({
      measurementId: GOOGLE_ANALYTICS_MEASUREMENT_ID,
      path,
    });
  }, [path]);

  return null;
}
