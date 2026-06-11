import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@faako/ui/compat.css";
import appSystem from "../appSystem.js";
import {
  initializeGoogleAnalytics,
  isGoogleAnalyticsEnabledForEnvironment,
  resolveGoogleAnalyticsMeasurementId,
  syncMobileBrowserChrome,
  trackGoogleAnalyticsPageView,
} from "@faako/utils";
import App from "./App.jsx";

const googleAnalyticsMeasurementId = resolveGoogleAnalyticsMeasurementId(
  import.meta.env.VITE_GA_MEASUREMENT_ID,
  import.meta.env.VITE_GA_ID,
);
const googleAnalyticsEnabled = isGoogleAnalyticsEnabledForEnvironment(
  import.meta.env.PROD,
  import.meta.env.VITE_ENABLE_GA_IN_DEV,
);

syncMobileBrowserChrome({ fallbackColor: appSystem.brand.browserChromeColor || "#f6f7fb" });
if (initializeGoogleAnalytics({
  measurementId: googleAnalyticsMeasurementId,
  enabled: googleAnalyticsEnabled,
})) {
  trackGoogleAnalyticsPageView({ measurementId: googleAnalyticsMeasurementId });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
