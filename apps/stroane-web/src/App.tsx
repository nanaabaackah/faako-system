import "./styles/globals.css";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter as Router, useLocation } from "react-router-dom";
import { AppBottomBar, AnimatedLoadingState, AppUpdateNotice, GoogleAnalyticsRouteTracker } from "@faako/ui";
import { resolveAppSurface } from "./config/appSurface";
import {
  hasStroaneAnalyticsConsent,
  STROANE_COOKIE_PREFS_EVENT,
  type StroaneCookiePreferences,
} from "./frontend/utils/cookieConsent";

const PortalApp = lazy(() => import("./portal/PortalApp"));
const StorefrontApp = lazy(() => import("./frontend/StorefrontApp"));

const GOOGLE_ANALYTICS_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || import.meta.env.VITE_GA_ID;
const GOOGLE_ANALYTICS_ENABLED =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_GA_IN_DEV === "true";
const APP_UPDATE_NOTICE_ENABLED =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_APP_UPDATE_NOTICE === "true";

const isPortalPath = (pathname: string) => pathname === "/login" || pathname.startsWith("/admin");

const SurfaceApp: React.FC = () => {
  const location = useLocation();
  const surface = resolveAppSurface();
  const isLocalPortalPath = surface === "combined" && isPortalPath(location.pathname);

  if (surface === "portal" || isLocalPortalPath) return <PortalApp />;
  return <StorefrontApp />;
};

const StroaneUpdateNotice: React.FC = () => {
  const location = useLocation();
  const surface = resolveAppSurface();
  const isPortalSurface = surface === "portal" || (surface === "combined" && isPortalPath(location.pathname));

  return (
    <AppUpdateNotice
      appName="Stroane"
      checkUrl="/"
      mode={isPortalSurface ? "prompt" : "auto"}
      enabled={APP_UPDATE_NOTICE_ENABLED}
    />
  );
};

const StroaneAnalyticsTracker: React.FC = () => {
  const location = useLocation();
  const surface = resolveAppSurface();
  const [analyticsAllowed, setAnalyticsAllowed] = useState(hasStroaneAnalyticsConsent);
  const isStorefrontSurface = surface === "storefront" || (surface === "combined" && !isPortalPath(location.pathname));

  useEffect(() => {
    const handlePreferences = (event: Event) => {
      const detail = (event as CustomEvent<StroaneCookiePreferences>).detail;
      setAnalyticsAllowed(Boolean(detail?.analytics));
    };

    window.addEventListener(STROANE_COOKIE_PREFS_EVENT, handlePreferences);
    return () => window.removeEventListener(STROANE_COOKIE_PREFS_EVENT, handlePreferences);
  }, []);

  return (
    <GoogleAnalyticsRouteTracker
      measurementId={GOOGLE_ANALYTICS_MEASUREMENT_ID}
      enabled={GOOGLE_ANALYTICS_ENABLED}
      shouldTrack={() => !isStorefrontSurface || analyticsAllowed}
    />
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <StroaneAnalyticsTracker />
      <StroaneUpdateNotice />
      <Suspense
        fallback={
          <AnimatedLoadingState
            page
            variant="storefront"
            title="Loading Stroane"
            message="Preparing the next view."
          />
        }
      >
        <SurfaceApp />
      </Suspense>

      <div className="ui-bottom-bar-shell portal-app-bottom-bar-shell">
        <AppBottomBar />
      </div>
    </Router>
  );
};

export default App;
