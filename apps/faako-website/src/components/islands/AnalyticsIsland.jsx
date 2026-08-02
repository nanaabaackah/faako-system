import { useEffect, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { GoogleAnalyticsRouteTracker } from "@faako/ui";
import {
  FAAKO_COOKIE_PREFS_EVENT,
  hasFaakoAnalyticsConsent,
} from "../../utils/cookieConsent.js";

const measurementId =
  import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID;
const enabled =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_GA_IN_DEV === "true";

export default function AnalyticsIsland({ path = "/" }) {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    setAnalyticsAllowed(hasFaakoAnalyticsConsent());

    const handlePreferences = (event) => {
      setAnalyticsAllowed(Boolean(event.detail?.analytics));
    };

    window.addEventListener(FAAKO_COOKIE_PREFS_EVENT, handlePreferences);
    return () =>
      window.removeEventListener(FAAKO_COOKIE_PREFS_EVENT, handlePreferences);
  }, []);

  if (!measurementId || !enabled || !analyticsAllowed) return null;

  return (
    <MemoryRouter initialEntries={[path]}>
      <GoogleAnalyticsRouteTracker
        measurementId={measurementId}
        enabled
        consent={{ analyticsStorage: "granted" }}
      />
    </MemoryRouter>
  );
}
